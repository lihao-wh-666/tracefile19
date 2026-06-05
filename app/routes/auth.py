from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import (
    create_access_token,
    jwt_required,
    get_jwt_identity,
    get_jwt
)
from app.models import db, User, UserNotificationSettings, ChatRoom, ChatRoomMember
from app.rsa_utils import get_public_key_pem, decrypt_rsa

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/public-key', methods=['GET'])
def get_public_key():
    public_key = get_public_key_pem()
    return jsonify({'public_key': public_key}), 200

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    username = data.get('username')
    email = data.get('email')
    encrypted_password = data.get('password')
    
    if not username or not email or not encrypted_password:
        return jsonify({'error': 'Username, email and password are required'}), 400
    
    password = decrypt_rsa(encrypted_password)
    if not password:
        return jsonify({'error': 'Password decryption failed'}), 400
    
    if len(username) < 3:
        return jsonify({'error': 'Username must be at least 3 characters'}), 400
    
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400
    
    existing_user = User.query.filter(
        (User.username == username) | (User.email == email)
    ).first()
    
    if existing_user:
        if existing_user.username == username:
            return jsonify({'error': 'Username already exists'}), 400
        if existing_user.email == email:
            return jsonify({'error': 'Email already exists'}), 400
    
    user = User(
        username=username,
        email=email,
        role='user',
        is_active=True
    )
    user.set_password(password)
    
    db.session.add(user)
    db.session.flush()
    
    notify_settings = UserNotificationSettings(user_id=user.id)
    db.session.add(notify_settings)
    
    default_room = ChatRoom.query.filter_by(name='开发者广场', type='group').first()
    if default_room:
        member = ChatRoomMember(room_id=default_room.id, user_id=user.id)
        db.session.add(member)
    
    db.session.commit()
    
    access_token = create_access_token(identity=str(user.id))
    
    return jsonify({
        'message': 'User registered successfully',
        'access_token': access_token,
        'user': user.to_dict(include_email=True)
    }), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    email = data.get('email')
    encrypted_password = data.get('password')
    
    if not email or not encrypted_password:
        return jsonify({'error': 'Email and password are required'}), 400
    
    password = decrypt_rsa(encrypted_password)
    if not password:
        return jsonify({'error': 'Password decryption failed'}), 400
    
    user = User.query.filter_by(email=email).first()
    
    if not user:
        return jsonify({'error': 'Invalid email or password'}), 401
    
    if not user.is_active:
        return jsonify({'error': 'Account is deactivated'}), 401
    
    max_attempts = current_app.config.get('MAX_LOGIN_ATTEMPTS', 5)
    lock_window = current_app.config.get('LOGIN_LOCK_WINDOW_MINUTES', 30)
    
    if user.is_login_locked(max_attempts, lock_window):
        remaining_seconds = user.get_lock_remaining_seconds(lock_window)
        minutes = remaining_seconds // 60
        seconds = remaining_seconds % 60
        return jsonify({
            'error': f'Too many failed login attempts. Please try again in {minutes}m {seconds}s',
            'locked': True,
            'remaining_seconds': remaining_seconds
        }), 429
    
    if not user.check_password(password):
        user.increment_failed_attempts()
        db.session.commit()
        
        attempts_left = max_attempts - user.failed_login_attempts
        response_data = {'error': 'Invalid email or password'}
        
        if user.failed_login_attempts >= max_attempts:
            remaining_seconds = user.get_lock_remaining_seconds(lock_window)
            response_data['locked'] = True
            response_data['remaining_seconds'] = remaining_seconds
            response_data['error'] = f'Too many failed login attempts. Account is locked for {lock_window} minutes'
        elif attempts_left > 0:
            response_data['attempts_left'] = attempts_left
        
        return jsonify(response_data), 401
    
    user.reset_failed_attempts()
    db.session.commit()
    
    access_token = create_access_token(identity=str(user.id))
    
    return jsonify({
        'message': 'Login successful',
        'access_token': access_token,
        'user': user.to_dict(include_email=True)
    }), 200


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    current_user_id = int(get_jwt_identity())
    user = User.query.get(current_user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify({
        'user': user.to_dict(include_email=True)
    }), 200


@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    return jsonify({'message': 'Logout successful'}), 200


@auth_bp.route('/check-username', methods=['POST'])
def check_username():
    data = request.get_json()
    username = data.get('username')
    
    if not username:
        return jsonify({'error': 'Username is required'}), 400
    
    existing = User.query.filter_by(username=username).first()
    return jsonify({'available': existing is None}), 200


@auth_bp.route('/check-email', methods=['POST'])
def check_email():
    data = request.get_json()
    email = data.get('email')
    
    if not email:
        return jsonify({'error': 'Email is required'}), 400
    
    existing = User.query.filter_by(email=email).first()
    return jsonify({'available': existing is None}), 200
