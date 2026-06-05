from flask_jwt_extended import decode_token
from flask import request
from app.models import User

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
