from flask_socketio import emit, join_room, leave_room
from app import socketio
from app.models import ChatRoomMember
from app.socket_events.utils import get_user_from_token


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
