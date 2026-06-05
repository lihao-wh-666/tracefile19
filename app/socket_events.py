from flask_socketio import emit, join_room, leave_room
from flask_jwt_extended import decode_token
from flask import request
from datetime import datetime
from app import socketio
from app.models import db, User, ChatRoom, ChatRoomMember, ChatMessage, UserNotificationSettings

connected_users = {}
sid_to_user = {}


def get_user_from_token():
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return None
    
    try:
        token = auth_header.split(' ')[1]
        decoded = decode_token(token)
        user_id = int(decoded['sub'])
        return User.query.get(user_id)
    except Exception:
        return None


@socketio.on('connect')
def handle_connect():
    user = get_user_from_token()
    if user:
        sid_to_user[request.sid] = user.id
        connected_users[user.id] = request.sid
        
        memberships = ChatRoomMember.query.filter_by(user_id=user.id).all()
        for membership in memberships:
            join_room(f"room_{membership.room_id}")
        
        emit('user_connected', {
            'user_id': user.id,
            'username': user.username
        }, broadcast=True)
        
        return True
    return False


@socketio.on('disconnect')
def handle_disconnect():
    user_id = sid_to_user.pop(request.sid, None)
    if user_id:
        if user_id in connected_users and connected_users[user_id] == request.sid:
            del connected_users[user_id]
        
        user = User.query.get(user_id)
        if user:
            emit('user_disconnected', {
                'user_id': user.id,
                'username': user.username
            }, broadcast=True)


@socketio.on('join_room')
def handle_join_room(data):
    user = get_user_from_token()
    if not user:
        return
    
    room_id = data.get('room_id')
    if room_id:
        membership = ChatRoomMember.query.filter_by(
            room_id=room_id,
            user_id=user.id
        ).first()
        
        if membership:
            join_room(f"room_{room_id}")
            emit('room_joined', {'room_id': room_id, 'user_id': user.id}, room=f"room_{room_id}")


@socketio.on('leave_room')
def handle_leave_room(data):
    user = get_user_from_token()
    if not user:
        return
    
    room_id = data.get('room_id')
    if room_id:
        leave_room(f"room_{room_id}")
        emit('room_left', {'room_id': room_id, 'user_id': user.id}, room=f"room_{room_id}")


@socketio.on('send_message')
def handle_send_message(data):
    user = get_user_from_token()
    if not user:
        emit('error', {'message': 'Unauthorized'})
        return
    
    room_id = data.get('room_id')
    content = data.get('content', '').strip()
    message_type = data.get('message_type', 'text')
    
    if not room_id or not content:
        emit('error', {'message': 'Room ID and content are required'})
        return
    
    membership = ChatRoomMember.query.filter_by(
        room_id=room_id,
        user_id=user.id
    ).first()
    
    if not membership:
        emit('error', {'message': 'Not a member of this room'})
        return
    
    message = ChatMessage(
        room_id=room_id,
        user_id=user.id,
        content=content,
        message_type=message_type
    )
    db.session.add(message)
    
    room = ChatRoom.query.get(room_id)
    room.updated_at = datetime.utcnow()
    
    other_members = ChatRoomMember.query.filter(
        ChatRoomMember.room_id == room_id,
        ChatRoomMember.user_id != user.id
    ).all()
    
    for member in other_members:
        member.unread_count += 1
    
    db.session.commit()
    
    message_data = message.to_dict()
    
    emit('new_message', message_data, room=f"room_{room_id}")
    
    for member in other_members:
        member_user = member.user
        settings = member_user.get_notification_settings()
        
        should_notify = False
        if room.type == 'private' and settings.private_message_notify:
            should_notify = True
        elif room.type == 'group' and settings.group_message_notify:
            should_notify = True
        
        if should_notify and member.user_id in connected_users:
            emit('notification', {
                'type': 'new_message',
                'room_type': room.type,
                'room_id': room_id,
                'room_name': room.name if room.type == 'group' else user.username,
                'from_user': user.username,
                'message': content,
                'message_data': message_data
            }, to=connected_users[member.user_id])


@socketio.on('typing')
def handle_typing(data):
    user = get_user_from_token()
    if not user:
        return
    
    room_id = data.get('room_id')
    is_typing = data.get('is_typing', False)
    
    if room_id:
        emit('user_typing', {
            'room_id': room_id,
            'user_id': user.id,
            'username': user.username,
            'is_typing': is_typing
        }, room=f"room_{room_id}", include_self=False)


@socketio.on('mark_read')
def handle_mark_read(data):
    user = get_user_from_token()
    if not user:
        return
    
    room_id = data.get('room_id')
    if room_id:
        membership = ChatRoomMember.query.filter_by(
            room_id=room_id,
            user_id=user.id
        ).first()
        
        if membership:
            membership.last_read_at = datetime.utcnow()
            membership.unread_count = 0
            db.session.commit()
            
            emit('message_read', {
                'room_id': room_id,
                'user_id': user.id
            }, room=f"room_{room_id}")
