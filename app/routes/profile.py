from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
import os
import uuid
from werkzeug.utils import secure_filename
from app.models import db, User
from app.rsa_utils import decrypt_rsa

profile_bp = Blueprint('profile', __name__)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@profile_bp.route('', methods=['GET'])
@jwt_required()
def get_profile():
    current_user_id = int(get_jwt_identity())
    user = User.query.get(current_user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify({
        'user': user.to_dict(include_email=True)
    }), 200


@profile_bp.route('/<int:user_id>', methods=['GET'])
def get_user_profile(user_id):
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    if not user.is_active:
        return jsonify({'error': 'User profile is not available'}), 403
    
    return jsonify({
        'user': user.to_dict()
    }), 200


@profile_bp.route('', methods=['PUT'])
@jwt_required()
def update_profile():
    current_user_id = int(get_jwt_identity())
    user = User.query.get(current_user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    
    if 'username' in data:
        username = data['username']
        if len(username) < 3:
            return jsonify({'error': 'Username must be at least 3 characters'}), 400
        existing = User.query.filter(User.username == username, User.id != user.id).first()
        if existing:
            return jsonify({'error': 'Username already exists'}), 400
        user.username = username
    
    if 'bio' in data:
        user.bio = data['bio']
    
    if 'skills' in data:
        user.skills = data['skills']
    
    if 'avatar' in data:
        user.avatar = data['avatar']
    
    db.session.commit()
    
    return jsonify({
        'message': 'Profile updated successfully',
        'user': user.to_dict(include_email=True)
    }), 200


@profile_bp.route('/password', methods=['PUT'])
@jwt_required()
def change_password():
    current_user_id = int(get_jwt_identity())
    user = User.query.get(current_user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    encrypted_current_password = data.get('current_password')
    encrypted_new_password = data.get('new_password')
    
    if not encrypted_current_password or not encrypted_new_password:
        return jsonify({'error': 'Current password and new password are required'}), 400
    
    current_password = decrypt_rsa(encrypted_current_password)
    new_password = decrypt_rsa(encrypted_new_password)
    
    if not current_password or not new_password:
        return jsonify({'error': 'Password decryption failed'}), 400
    
    if not user.check_password(current_password):
        return jsonify({'error': 'Current password is incorrect'}), 400
    
    if len(new_password) < 6:
        return jsonify({'error': 'New password must be at least 6 characters'}), 400
    
    user.set_password(new_password)
    db.session.commit()
    
    return jsonify({'message': 'Password changed successfully'}), 200


@profile_bp.route('/avatar', methods=['POST'])
@jwt_required()
def upload_avatar():
    current_user_id = int(get_jwt_identity())
    user = User.query.get(current_user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file and allowed_file(file.filename):
        ext = file.filename.rsplit('.', 1)[1].lower()
        filename = f"{uuid.uuid4()}.{ext}"
        filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        user.avatar = f"/uploads/{filename}"
        db.session.commit()
        
        return jsonify({
            'message': 'Avatar uploaded successfully',
            'avatar_url': f"/uploads/{filename}"
        }), 200
    
    return jsonify({'error': 'Invalid file type'}), 400


@profile_bp.route('/list', methods=['GET'])
def list_users():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    search = request.args.get('search', '')
    
    query = User.query.filter(User.role == 'user', User.is_active == True)
    
    if search:
        query = query.filter(
            (User.username.ilike(f'%{search}%')) |
            (User.bio.ilike(f'%{search}%')) |
            (User.skills.ilike(f'%{search}%'))
        )
    
    pagination = query.order_by(User.created_at.desc()).paginate(page=page, per_page=per_page)
    
    return jsonify({
        'users': [user.to_dict() for user in pagination.items],
        'total': pagination.total,
        'pages': pagination.pages,
        'page': page,
        'per_page': per_page
    }), 200
