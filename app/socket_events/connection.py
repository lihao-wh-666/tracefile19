from flask_socketio import emit, join_room
from flask import request
from app import socketio
from app.models import User, ChatRoomMember
from app.socket_events.utils import connected_users, sid_to_user, get_user_from_token


@socketio.on('connect')
def handle_connect():
    user = get_user_from_token()
    if user:
        sid_to_user[request.sid] = user.id
        connected_users[user.id] = request.sid
        
        memberships = ChatRoomMember.query.filter_by(user_id=user.id).all()
        for membership in memberships:
            join_room(f"room_{membership.room_id}")
        
        join_room(f"user_{user.id}")
        
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
