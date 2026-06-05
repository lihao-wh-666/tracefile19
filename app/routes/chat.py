from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from app.models import db, User, ChatRoom, ChatRoomMember, ChatMessage, UserNotificationSettings
from app import log_operation_from_request

chat_bp = Blueprint('chat', __name__)


@chat_bp.route('/rooms', methods=['GET'])
@jwt_required()
def get_rooms():
    current_user_id = int(get_jwt_identity())
    user = User.query.get(current_user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    memberships = ChatRoomMember.query.filter_by(user_id=current_user_id).all()
    room_ids = [m.room_id for m in memberships]
    
    rooms = ChatRoom.query.filter(ChatRoom.id.in_(room_ids)).order_by(ChatRoom.updated_at.desc()).all()
    
    return jsonify({
        'rooms': [room.to_dict(current_user_id) for room in rooms]
    }), 200


@chat_bp.route('/rooms/private/<int:user_id>', methods=['POST'])
@jwt_required()
def create_private_room(user_id):
    current_user_id = int(get_jwt_identity())
    
    if user_id == current_user_id:
        return jsonify({'error': 'Cannot create chat with yourself'}), 400
    
    other_user = User.query.get(user_id)
    if not other_user:
        return jsonify({'error': 'User not found'}), 404
    
    existing_room = db.session.query(ChatRoom).join(ChatRoomMember).filter(
        ChatRoom.type == 'private',
        ChatRoomMember.user_id.in_([current_user_id, user_id])
    ).group_by(ChatRoom.id).having(db.func.count(ChatRoomMember.id) == 2).first()
    
    if existing_room:
        return jsonify({
            'room': existing_room.to_dict(current_user_id)
        }), 200
    
    room = ChatRoom(
        type='private',
        created_by=current_user_id
    )
    db.session.add(room)
    db.session.flush()
    
    member1 = ChatRoomMember(room_id=room.id, user_id=current_user_id)
    member2 = ChatRoomMember(room_id=room.id, user_id=user_id)
    db.session.add_all([member1, member2])
    
    db.session.commit()
    
    return jsonify({
        'room': room.to_dict(current_user_id)
    }), 201


@chat_bp.route('/rooms/<int:room_id>/messages', methods=['GET'])
@jwt_required()
def get_messages(room_id):
    current_user_id = int(get_jwt_identity())
    
    membership = ChatRoomMember.query.filter_by(
        room_id=room_id,
        user_id=current_user_id
    ).first()
    
    if not membership:
        return jsonify({'error': 'Not a member of this room'}), 403
    
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    
    query = ChatMessage.query.filter_by(room_id=room_id).order_by(ChatMessage.created_at.desc())
    
    total = query.count()
    messages = query.offset((page - 1) * per_page).limit(per_page).all()
    messages.reverse()
    
    membership.last_read_at = datetime.utcnow()
    membership.unread_count = 0
    db.session.commit()
    
    return jsonify({
        'messages': [msg.to_dict() for msg in messages],
        'page': page,
        'per_page': per_page,
        'total': total,
        'pages': (total + per_page - 1) // per_page
    }), 200


@chat_bp.route('/rooms/<int:room_id>/messages', methods=['POST'])
@jwt_required()
def send_message(room_id):
    current_user_id = int(get_jwt_identity())
    data = request.get_json()
    
    content = data.get('content', '').strip()
    message_type = data.get('message_type', 'text')
    
    if not content:
        return jsonify({'error': 'Message content is required'}), 400
    
    membership = ChatRoomMember.query.filter_by(
        room_id=room_id,
        user_id=current_user_id
    ).first()
    
    if not membership:
        return jsonify({'error': 'Not a member of this room'}), 403
    
    message = ChatMessage(
        room_id=room_id,
        user_id=current_user_id,
        content=content,
        message_type=message_type
    )
    db.session.add(message)
    
    room = ChatRoom.query.get(room_id)
    room.updated_at = datetime.utcnow()
    
    other_members = ChatRoomMember.query.filter(
        ChatRoomMember.room_id == room_id,
        ChatRoomMember.user_id != current_user_id
    ).all()
    
    for member in other_members:
        member.unread_count += 1
    
    db.session.commit()
    
    return jsonify({
        'message': message.to_dict()
    }), 201


@chat_bp.route('/rooms/<int:room_id>/read', methods=['POST'])
@jwt_required()
def mark_as_read(room_id):
    current_user_id = int(get_jwt_identity())
    
    membership = ChatRoomMember.query.filter_by(
        room_id=room_id,
        user_id=current_user_id
    ).first()
    
    if not membership:
        return jsonify({'error': 'Not a member of this room'}), 403
    
    membership.last_read_at = datetime.utcnow()
    membership.unread_count = 0
    db.session.commit()
    
    return jsonify({'message': 'Marked as read'}), 200


@chat_bp.route('/rooms/<int:room_id>/join', methods=['POST'])
@jwt_required()
def join_room(room_id):
    current_user_id = int(get_jwt_identity())
    
    room = ChatRoom.query.get(room_id)
    if not room:
        return jsonify({'error': 'Room not found'}), 404
    
    if room.type != 'group':
        return jsonify({'error': 'Can only join group rooms'}), 400
    
    existing = ChatRoomMember.query.filter_by(
        room_id=room_id,
        user_id=current_user_id
    ).first()
    
    if existing:
        return jsonify({'error': 'Already a member'}), 400
    
    member = ChatRoomMember(room_id=room_id, user_id=current_user_id)
    db.session.add(member)
    db.session.commit()
    
    return jsonify({'message': 'Joined room successfully'}), 200


@chat_bp.route('/rooms/<int:room_id>/leave', methods=['POST'])
@jwt_required()
def leave_room(room_id):
    current_user_id = int(get_jwt_identity())
    
    membership = ChatRoomMember.query.filter_by(
        room_id=room_id,
        user_id=current_user_id
    ).first()
    
    if not membership:
        return jsonify({'error': 'Not a member of this room'}), 403
    
    room = ChatRoom.query.get(room_id)
    user = User.query.get(current_user_id)
    
    if room.type == 'group' and room.created_by == current_user_id:
        other_members = ChatRoomMember.query.filter(
            ChatRoomMember.room_id == room_id,
            ChatRoomMember.user_id != current_user_id
        ).first()
        if other_members:
            room.created_by = other_members.user_id
        else:
            db.session.delete(room)
            db.session.commit()
            return jsonify({'message': 'Room deleted'}), 200
    
    if room.type == 'group':
        system_message = ChatMessage(
            room_id=room_id,
            user_id=current_user_id,
            content=f'{user.username} 退出了群聊',
            message_type='system'
        )
        db.session.add(system_message)
        room.updated_at = datetime.utcnow()
    
    db.session.delete(membership)
    db.session.commit()
    
    return jsonify({'message': 'Left room successfully'}), 200


@chat_bp.route('/rooms/<int:room_id>/members', methods=['GET'])
@jwt_required()
def get_room_members(room_id):
    current_user_id = int(get_jwt_identity())
    
    membership = ChatRoomMember.query.filter_by(
        room_id=room_id,
        user_id=current_user_id
    ).first()
    
    if not membership:
        return jsonify({'error': 'Not a member of this room'}), 403
    
    members = ChatRoomMember.query.filter_by(room_id=room_id).all()
    
    return jsonify({
        'members': [m.to_dict() for m in members]
    }), 200


@chat_bp.route('/notifications', methods=['GET'])
@jwt_required()
def get_notification_settings():
    current_user_id = int(get_jwt_identity())
    user = User.query.get(current_user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    settings = user.get_notification_settings()
    
    return jsonify({
        'settings': settings.to_dict()
    }), 200


@chat_bp.route('/notifications', methods=['PUT'])
@jwt_required()
def update_notification_settings():
    current_user_id = int(get_jwt_identity())
    data = request.get_json()
    
    user = User.query.get(current_user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    settings = user.get_notification_settings()
    
    if 'private_message_notify' in data:
        settings.private_message_notify = data['private_message_notify']
    
    if 'group_message_notify' in data:
        settings.group_message_notify = data['group_message_notify']
    
    db.session.commit()
    
    return jsonify({
        'settings': settings.to_dict()
    }), 200


@chat_bp.route('/rooms/<int:room_id>', methods=['DELETE'])
@jwt_required()
def delete_room(room_id):
    current_user_id = int(get_jwt_identity())
    
    room = ChatRoom.query.get(room_id)
    if not room:
        return jsonify({'error': 'Room not found'}), 404
    
    membership = ChatRoomMember.query.filter_by(
        room_id=room_id,
        user_id=current_user_id
    ).first()
    
    if not membership:
        return jsonify({'error': 'Not a member of this room'}), 403
    
    room_name = room.name
    room_type = room.type
    members_count = len(room.members)
    
    if room.type == 'group':
        if room.created_by != current_user_id:
            return jsonify({'error': 'Only group owner can delete the room'}), 403
        
        db.session.delete(room)
        db.session.commit()
        
        log_operation_from_request(
            operation_type='delete',
            target_type='chat_room',
            target_id=room_id,
            user_id=current_user_id,
            details={'room_name': room_name, 'room_type': room_type, 'members_count': members_count}
        )
        
        return jsonify({'message': 'Group deleted successfully'}), 200
    
    if room.type == 'private':
        db.session.delete(room)
        db.session.commit()
        
        log_operation_from_request(
            operation_type='delete',
            target_type='chat_room',
            target_id=room_id,
            user_id=current_user_id,
            details={'room_name': room_name, 'room_type': room_type}
        )
        
        return jsonify({'message': 'Chat deleted successfully'}), 200
    
    return jsonify({'error': 'Invalid room type'}), 400


@chat_bp.route('/unread', methods=['GET'])
@jwt_required()
def get_unread_count():
    current_user_id = int(get_jwt_identity())
    
    memberships = ChatRoomMember.query.filter_by(user_id=current_user_id).all()
    total_unread = sum(m.unread_count for m in memberships)
    
    return jsonify({
        'total_unread': total_unread,
        'rooms': [{
            'room_id': m.room_id,
            'unread_count': m.unread_count
        } for m in memberships if m.unread_count > 0]
    }), 200


@chat_bp.route('/rooms/<int:room_id>/messages/<int:message_id>', methods=['DELETE'])
@jwt_required()
def delete_message(room_id, message_id):
    current_user_id = int(get_jwt_identity())
    
    membership = ChatRoomMember.query.filter_by(
        room_id=room_id,
        user_id=current_user_id
    ).first()
    
    if not membership:
        return jsonify({'error': 'Not a member of this room'}), 403
    
    message = ChatMessage.query.get(message_id)
    if not message or message.room_id != room_id:
        return jsonify({'error': 'Message not found'}), 404
    
    if message.user_id != current_user_id and membership.room.created_by != current_user_id:
        return jsonify({'error': 'Permission denied'}), 403
    
    content_preview = message.content[:200] if message.content else ''
    message_sender = message.user.username if message.user else 'Unknown'
    room_name = membership.room.name
    
    db.session.delete(message)
    db.session.commit()
    
    log_operation_from_request(
        operation_type='delete',
        target_type='chat_message',
        target_id=message_id,
        user_id=current_user_id,
        details={
            'room_id': room_id,
            'room_name': room_name,
            'room_type': membership.room.type,
            'message_sender': message_sender,
            'sender_id': message.user_id,
            'content_preview': content_preview
        }
    )
    
    return jsonify({'message': 'Message deleted successfully'}), 200


@chat_bp.route('/rooms/<int:room_id>/members/<int:user_id>', methods=['DELETE'])
@jwt_required()
def remove_member(room_id, user_id):
    current_user_id = int(get_jwt_identity())
    
    room = ChatRoom.query.get(room_id)
    if not room:
        return jsonify({'error': 'Room not found'}), 404
    
    if room.type != 'group':
        return jsonify({'error': 'Can only remove members from group rooms'}), 400
    
    if room.created_by != current_user_id:
        return jsonify({'error': 'Only group owner can remove members'}), 403
    
    if user_id == current_user_id:
        return jsonify({'error': 'Cannot remove yourself'}), 400
    
    membership = ChatRoomMember.query.filter_by(
        room_id=room_id,
        user_id=user_id
    ).first()
    
    if not membership:
        return jsonify({'error': 'User is not a member of this room'}), 404
    
    removed_user = membership.user
    removed_username = removed_user.username if removed_user else 'Unknown'
    membership_id = membership.id
    
    system_message = ChatMessage(
        room_id=room_id,
        user_id=current_user_id,
        content=f'{removed_username} 被移出了群聊',
        message_type='system'
    )
    db.session.add(system_message)
    
    db.session.delete(membership)
    db.session.commit()
    
    log_operation_from_request(
        operation_type='remove_member',
        target_type='chat_room_member',
        target_id=membership_id,
        user_id=current_user_id,
        details={
            'room_id': room_id,
            'room_name': room.name,
            'removed_user_id': user_id,
            'removed_username': removed_username
        }
    )
    
    return jsonify({'message': 'Member removed successfully'}), 200


@chat_bp.route('/rooms/group', methods=['POST'])
@jwt_required()
def create_group_room():
    current_user_id = int(get_jwt_identity())
    data = request.get_json()
    
    name = data.get('name')
    member_ids = data.get('member_ids', [])
    
    if not name:
        return jsonify({'error': 'Room name is required'}), 400
    
    room = ChatRoom(
        name=name,
        type='group',
        created_by=current_user_id
    )
    db.session.add(room)
    db.session.flush()
    
    creator_member = ChatRoomMember(room_id=room.id, user_id=current_user_id)
    db.session.add(creator_member)
    
    for uid in member_ids:
        if uid != current_user_id:
            member = ChatRoomMember(room_id=room.id, user_id=uid)
            db.session.add(member)
    
    db.session.commit()
    
    log_operation_from_request(
        operation_type='create',
        target_type='chat_room',
        target_id=room.id,
        user_id=current_user_id,
        details={'room_name': name, 'member_ids': member_ids}
    )
    
    return jsonify({
        'room': room.to_dict(current_user_id)
    }), 201
