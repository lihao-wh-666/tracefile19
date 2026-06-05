from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from app.models import db, User, Project, ProjectMember, ChatRoom, ChatRoomMember, PROJECT_CHANNELS
from app import log_operation_from_request

projects_bp = Blueprint('projects', __name__)


@projects_bp.route('', methods=['GET'])
@jwt_required()
def get_projects():
    current_user_id = int(get_jwt_identity())
    
    memberships = ProjectMember.query.filter_by(user_id=current_user_id).all()
    project_ids = [m.project_id for m in memberships]
    
    projects = Project.query.filter(Project.id.in_(project_ids)).order_by(Project.updated_at.desc()).all()
    
    return jsonify({
        'projects': [project.to_dict(current_user_id) for project in projects]
    }), 200


@projects_bp.route('', methods=['POST'])
@jwt_required()
def create_project():
    current_user_id = int(get_jwt_identity())
    data = request.get_json()
    
    name = data.get('name', '').strip()
    description = data.get('description', '').strip()
    member_ids = data.get('member_ids', [])
    
    if not name:
        return jsonify({'error': '项目名称不能为空'}), 400
    
    project = Project(
        name=name,
        description=description,
        created_by=current_user_id
    )
    db.session.add(project)
    db.session.flush()
    
    owner_member = ProjectMember(
        project_id=project.id,
        user_id=current_user_id,
        role='owner'
    )
    db.session.add(owner_member)
    
    for uid in member_ids:
        if uid != current_user_id:
            user = User.query.get(uid)
            if user:
                member = ProjectMember(
                    project_id=project.id,
                    user_id=uid,
                    role='member'
                )
                db.session.add(member)
    
    all_member_ids = [current_user_id] + [uid for uid in member_ids if uid != current_user_id]
    
    for ch in PROJECT_CHANNELS:
        room = ChatRoom(
            name=f'{name} - {ch["name"]}',
            type='project',
            project_id=project.id,
            channel_type=ch['key'],
            created_by=current_user_id
        )
        db.session.add(room)
        db.session.flush()
        
        for uid in all_member_ids:
            room_member = ChatRoomMember(
                room_id=room.id,
                user_id=uid
            )
            db.session.add(room_member)
    
    db.session.commit()
    
    log_operation_from_request(
        operation_type='create',
        target_type='project',
        target_id=project.id,
        user_id=current_user_id,
        details={'project_name': name, 'member_ids': member_ids}
    )
    
    return jsonify({
        'project': project.to_dict(current_user_id)
    }), 201


@projects_bp.route('/<int:project_id>', methods=['GET'])
@jwt_required()
def get_project(project_id):
    current_user_id = int(get_jwt_identity())
    
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': '项目不存在'}), 404
    
    membership = ProjectMember.query.filter_by(
        project_id=project_id,
        user_id=current_user_id
    ).first()
    
    if not membership:
        return jsonify({'error': '你不是该项目成员'}), 403
    
    project_data = project.to_dict(current_user_id)
    project_data['channels'] = project.get_channels()
    
    return jsonify({
        'project': project_data
    }), 200


@projects_bp.route('/<int:project_id>', methods=['PUT'])
@jwt_required()
def update_project(project_id):
    current_user_id = int(get_jwt_identity())
    data = request.get_json()
    
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': '项目不存在'}), 404
    
    membership = ProjectMember.query.filter_by(
        project_id=project_id,
        user_id=current_user_id
    ).first()
    
    if not membership or membership.role not in ['owner', 'admin']:
        return jsonify({'error': '没有权限修改项目'}), 403
    
    if 'name' in data:
        name = data['name'].strip()
        if not name:
            return jsonify({'error': '项目名称不能为空'}), 400
        project.name = name
        
        for ch in PROJECT_CHANNELS:
            room = ChatRoom.query.filter_by(
                project_id=project_id,
                channel_type=ch['key']
            ).first()
            if room:
                room.name = f'{name} - {ch["name"]}'
    
    if 'description' in data:
        project.description = data['description'].strip()
    
    db.session.commit()
    
    log_operation_from_request(
        operation_type='update',
        target_type='project',
        target_id=project_id,
        user_id=current_user_id,
        details=data
    )
    
    return jsonify({
        'project': project.to_dict(current_user_id)
    }), 200


@projects_bp.route('/<int:project_id>', methods=['DELETE'])
@jwt_required()
def delete_project(project_id):
    current_user_id = int(get_jwt_identity())
    
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': '项目不存在'}), 404
    
    membership = ProjectMember.query.filter_by(
        project_id=project_id,
        user_id=current_user_id
    ).first()
    
    if not membership or membership.role != 'owner':
        return jsonify({'error': '只有项目所有者可以删除项目'}), 403
    
    project_name = project.name
    db.session.delete(project)
    db.session.commit()
    
    log_operation_from_request(
        operation_type='delete',
        target_type='project',
        target_id=project_id,
        user_id=current_user_id,
        details={'project_name': project_name}
    )
    
    return jsonify({'message': '项目已删除'}), 200


@projects_bp.route('/<int:project_id>/join', methods=['POST'])
@jwt_required()
def join_project(project_id):
    current_user_id = int(get_jwt_identity())
    
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': '项目不存在'}), 404
    
    existing = ProjectMember.query.filter_by(
        project_id=project_id,
        user_id=current_user_id
    ).first()
    
    if existing:
        return jsonify({'error': '你已经是该项目成员'}), 400
    
    member = ProjectMember(
        project_id=project_id,
        user_id=current_user_id,
        role='member'
    )
    db.session.add(member)
    
    for ch in PROJECT_CHANNELS:
        room = ChatRoom.query.filter_by(
            project_id=project_id,
            channel_type=ch['key']
        ).first()
        if room:
            room_member = ChatRoomMember(
                room_id=room.id,
                user_id=current_user_id
            )
            db.session.add(room_member)
    
    db.session.commit()
    
    log_operation_from_request(
        operation_type='join',
        target_type='project',
        target_id=project_id,
        user_id=current_user_id,
        details={'project_name': project.name}
    )
    
    return jsonify({'message': '成功加入项目'}), 200


@projects_bp.route('/<int:project_id>/leave', methods=['POST'])
@jwt_required()
def leave_project(project_id):
    current_user_id = int(get_jwt_identity())
    
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': '项目不存在'}), 404
    
    membership = ProjectMember.query.filter_by(
        project_id=project_id,
        user_id=current_user_id
    ).first()
    
    if not membership:
        return jsonify({'error': '你不是该项目成员'}), 400
    
    if membership.role == 'owner':
        other_members = ProjectMember.query.filter(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id != current_user_id
        ).first()
        if other_members:
            other_members.role = 'owner'
        else:
            db.session.delete(project)
            db.session.commit()
            return jsonify({'message': '项目已删除（最后一个成员退出）'}), 200
    
    for ch in PROJECT_CHANNELS:
        room = ChatRoom.query.filter_by(
            project_id=project_id,
            channel_type=ch['key']
        ).first()
        if room:
            room_member = ChatRoomMember.query.filter_by(
                room_id=room.id,
                user_id=current_user_id
            ).first()
            if room_member:
                db.session.delete(room_member)
    
    db.session.delete(membership)
    db.session.commit()
    
    log_operation_from_request(
        operation_type='leave',
        target_type='project',
        target_id=project_id,
        user_id=current_user_id,
        details={'project_name': project.name}
    )
    
    return jsonify({'message': '已退出项目'}), 200


@projects_bp.route('/<int:project_id>/channels', methods=['GET'])
@jwt_required()
def get_project_channels(project_id):
    current_user_id = int(get_jwt_identity())
    
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': '项目不存在'}), 404
    
    membership = ProjectMember.query.filter_by(
        project_id=project_id,
        user_id=current_user_id
    ).first()
    
    if not membership:
        return jsonify({'error': '你不是该项目成员'}), 403
    
    channels = project.get_channels()
    
    return jsonify({
        'channels': channels
    }), 200


@projects_bp.route('/<int:project_id>/members', methods=['GET'])
@jwt_required()
def get_project_members(project_id):
    current_user_id = int(get_jwt_identity())
    
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': '项目不存在'}), 404
    
    membership = ProjectMember.query.filter_by(
        project_id=project_id,
        user_id=current_user_id
    ).first()
    
    if not membership:
        return jsonify({'error': '你不是该项目成员'}), 403
    
    members = ProjectMember.query.filter_by(project_id=project_id).all()
    
    return jsonify({
        'members': [m.to_dict() for m in members]
    }), 200


@projects_bp.route('/<int:project_id>/members/<int:user_id>', methods=['DELETE'])
@jwt_required()
def remove_project_member(project_id, user_id):
    current_user_id = int(get_jwt_identity())
    
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': '项目不存在'}), 404
    
    membership = ProjectMember.query.filter_by(
        project_id=project_id,
        user_id=current_user_id
    ).first()
    
    if not membership or membership.role not in ['owner', 'admin']:
        return jsonify({'error': '没有权限移除成员'}), 403
    
    if user_id == current_user_id:
        return jsonify({'error': '不能移除自己'}), 400
    
    target_member = ProjectMember.query.filter_by(
        project_id=project_id,
        user_id=user_id
    ).first()
    
    if not target_member:
        return jsonify({'error': '用户不是项目成员'}), 404
    
    if target_member.role == 'owner':
        return jsonify({'error': '不能移除项目所有者'}), 403
    
    for ch in PROJECT_CHANNELS:
        room = ChatRoom.query.filter_by(
            project_id=project_id,
            channel_type=ch['key']
        ).first()
        if room:
            room_member = ChatRoomMember.query.filter_by(
                room_id=room.id,
                user_id=user_id
            ).first()
            if room_member:
                db.session.delete(room_member)
    
    db.session.delete(target_member)
    db.session.commit()
    
    log_operation_from_request(
        operation_type='remove_member',
        target_type='project_member',
        target_id=target_member.id,
        user_id=current_user_id,
        details={'project_id': project_id, 'removed_user_id': user_id}
    )
    
    return jsonify({'message': '成员已移除'}), 200
