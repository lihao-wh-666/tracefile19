from flask import Blueprint, request, jsonify, current_app, redirect, session, url_for
from flask_jwt_extended import (
    create_access_token,
    jwt_required,
    get_jwt_identity,
    get_jwt
)
from app.models import db, User, UserNotificationSettings, ChatRoom, ChatRoomMember, OAuthAccount
from app.rsa_utils import get_public_key_pem, decrypt_rsa
from app.services.oauth_service import (
    GitHubOAuth,
    QQOAuth,
    EmailService,
    OAuthAccountManager,
    generate_state,
)

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
            'error': f'Too many failed login attempts ({user.failed_login_attempts}/{max_attempts}). Please try again in {minutes}m {seconds}s',
            'locked': True,
            'remaining_seconds': remaining_seconds,
            'failed_attempts': user.failed_login_attempts,
            'max_attempts': max_attempts
        }), 429
    
    if not user.check_password(password):
        user.increment_failed_attempts()
        db.session.commit()
        
        attempts_left = max_attempts - user.failed_login_attempts
        failed_count = user.failed_login_attempts
        
        response_data = {
            'error': f'Invalid email or password. You have {failed_count} failed attempt(s), {attempts_left} attempt(s) left.',
            'failed_attempts': failed_count,
            'attempts_left': attempts_left
        }
        
        if user.failed_login_attempts >= max_attempts:
            remaining_seconds = user.get_lock_remaining_seconds(lock_window)
            minutes = remaining_seconds // 60
            seconds = remaining_seconds % 60
            response_data['locked'] = True
            response_data['remaining_seconds'] = remaining_seconds
            response_data['error'] = f'Too many failed login attempts ({failed_count}/{max_attempts}). Account is locked for {minutes}m {seconds}s'
        
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


@auth_bp.route('/oauth/providers', methods=['GET'])
def get_oauth_providers():
    providers = []
    
    github_client_id = current_app.config.get('GITHUB_CLIENT_ID')
    if github_client_id:
        providers.append({
            'provider': 'github',
            'name': 'GitHub',
            'icon': '🐙',
            'enabled': True
        })
    
    qq_app_id = current_app.config.get('QQ_APP_ID')
    if qq_app_id:
        providers.append({
            'provider': 'qq',
            'name': 'QQ',
            'icon': '🐧',
            'enabled': True
        })
    
    providers.append({
        'provider': 'email',
        'name': '邮箱验证码',
        'icon': '📧',
        'enabled': True
    })
    
    return jsonify({'providers': providers}), 200


@auth_bp.route('/oauth/github', methods=['GET'])
def oauth_github_login():
    client_id = current_app.config.get('GITHUB_CLIENT_ID')
    if not client_id:
        return jsonify({'error': 'GitHub登录未配置'}), 400
    
    state = generate_state()
    session['oauth_state'] = state
    session['oauth_provider'] = 'github'
    
    auth_url = GitHubOAuth.get_authorization_url(state)
    return jsonify({'auth_url': auth_url, 'state': state}), 200


@auth_bp.route('/oauth/github/callback', methods=['GET'])
def oauth_github_callback():
    code = request.args.get('code')
    state = request.args.get('state')
    error = request.args.get('error')
    
    if error:
        return _oauth_error_redirect('GitHub授权失败')
    
    if not code:
        return _oauth_error_redirect('缺少授权码')
    
    stored_state = session.pop('oauth_state', None)
    if not state or state != stored_state:
        return _oauth_error_redirect('状态验证失败')
    
    access_token = GitHubOAuth.get_access_token(code)
    if not access_token:
        return _oauth_error_redirect('获取访问令牌失败')
    
    user_info = GitHubOAuth.get_user_info(access_token)
    if not user_info:
        return _oauth_error_redirect('获取用户信息失败')
    
    user, error_msg = OAuthAccountManager.get_or_create_user(
        provider='github',
        provider_user_id=user_info['id'],
        user_info=user_info,
        email=user_info.get('email')
    )
    
    if error_msg:
        return _oauth_error_redirect(error_msg)
    
    access_token_jwt = create_access_token(identity=str(user.id))
    
    return _oauth_success_redirect(access_token_jwt, user)


@auth_bp.route('/oauth/qq', methods=['GET'])
def oauth_qq_login():
    app_id = current_app.config.get('QQ_APP_ID')
    if not app_id:
        return jsonify({'error': 'QQ登录未配置'}), 400
    
    state = generate_state()
    session['oauth_state'] = state
    session['oauth_provider'] = 'qq'
    
    auth_url = QQOAuth.get_authorization_url(state)
    return jsonify({'auth_url': auth_url, 'state': state}), 200


@auth_bp.route('/oauth/qq/callback', methods=['GET'])
def oauth_qq_callback():
    code = request.args.get('code')
    state = request.args.get('state')
    error = request.args.get('error')
    
    if error:
        return _oauth_error_redirect('QQ授权失败')
    
    if not code:
        return _oauth_error_redirect('缺少授权码')
    
    stored_state = session.pop('oauth_state', None)
    if not state or state != stored_state:
        return _oauth_error_redirect('状态验证失败')
    
    access_token = QQOAuth.get_access_token(code)
    if not access_token:
        return _oauth_error_redirect('获取访问令牌失败')
    
    open_id = QQOAuth.get_open_id(access_token)
    if not open_id:
        return _oauth_error_redirect('获取用户ID失败')
    
    user_info = QQOAuth.get_user_info(access_token, open_id)
    if not user_info:
        return _oauth_error_redirect('获取用户信息失败')
    
    user, error_msg = OAuthAccountManager.get_or_create_user(
        provider='qq',
        provider_user_id=open_id,
        user_info=user_info
    )
    
    if error_msg:
        return _oauth_error_redirect(error_msg)
    
    access_token_jwt = create_access_token(identity=str(user.id))
    
    return _oauth_success_redirect(access_token_jwt, user)


def _oauth_success_redirect(token, user):
    from urllib.parse import urlencode
    params = {
        'token': token,
        'user_id': user.id,
        'username': user.username,
        'avatar': user.avatar or '',
        'success': 'true'
    }
    redirect_url = f"/#/oauth-callback?{urlencode(params)}"
    return redirect(redirect_url)


def _oauth_error_redirect(error_msg):
    from urllib.parse import urlencode
    params = {
        'error': error_msg,
        'success': 'false'
    }
    redirect_url = f"/#/oauth-callback?{urlencode(params)}"
    return redirect(redirect_url)


@auth_bp.route('/email/send-code', methods=['POST'])
def send_email_code():
    data = request.get_json()
    email = data.get('email')
    purpose = data.get('purpose', 'login')
    
    if not email:
        return jsonify({'error': '邮箱不能为空'}), 400
    
    if purpose not in ['login', 'register', 'bind']:
        return jsonify({'error': '无效的用途'}), 400
    
    code = EmailService.create_verification_code(email, purpose)
    
    sent = EmailService.send_verification_email(email, code, purpose)
    
    if sent:
        return jsonify({'message': '验证码已发送，请查收邮箱'}), 200
    else:
        if current_app.debug or current_app.config.get('DEBUG', False):
            return jsonify({'message': '测试模式', 'code': code}), 200
        return jsonify({'error': '验证码发送失败，请稍后重试'}), 500


@auth_bp.route('/email/login', methods=['POST'])
def email_login():
    data = request.get_json()
    email = data.get('email')
    code = data.get('code')
    
    if not email or not code:
        return jsonify({'error': '邮箱和验证码不能为空'}), 400
    
    if not EmailService.verify_code(email, code, 'login'):
        return jsonify({'error': '验证码错误或已过期'}), 400
    
    user = User.query.filter_by(email=email).first()
    
    if not user:
        from app.services.oauth_service import generate_random_username
        username = email.split('@')[0]
        original_username = username
        counter = 1
        while User.query.filter_by(username=username).first():
            username = f"{original_username}_{counter}"
            counter += 1
        
        user = User(
            username=username,
            email=email,
            role='user',
            is_active=True
        )
        user.set_password(generate_random_username())
        db.session.add(user)
        db.session.flush()
        
        notify_settings = UserNotificationSettings(user_id=user.id)
        db.session.add(notify_settings)
        
        default_room = ChatRoom.query.filter_by(name='开发者广场', type='group').first()
        if default_room:
            member = ChatRoomMember(room_id=default_room.id, user_id=user.id)
            db.session.add(member)
        
        db.session.commit()
    
    if not user.is_active:
        return jsonify({'error': '账号已被禁用'}), 401
    
    access_token = create_access_token(identity=str(user.id))
    
    return jsonify({
        'message': '登录成功',
        'access_token': access_token,
        'user': user.to_dict(include_email=True)
    }), 200


@auth_bp.route('/oauth/accounts', methods=['GET'])
@jwt_required()
def get_oauth_accounts():
    current_user_id = int(get_jwt_identity())
    accounts = OAuthAccountManager.get_user_oauth_accounts(current_user_id)
    
    return jsonify({
        'accounts': accounts,
        'has_password': bool(User.query.get(current_user_id).password_hash)
    }), 200


@auth_bp.route('/oauth/unlink/<provider>', methods=['POST'])
@jwt_required()
def unlink_oauth_account(provider):
    current_user_id = int(get_jwt_identity())
    
    if provider not in ['github', 'qq']:
        return jsonify({'error': '不支持的第三方账号'}), 400
    
    success, error_msg = OAuthAccountManager.unlink_account(current_user_id, provider)
    
    if not success:
        return jsonify({'error': error_msg}), 400
    
    return jsonify({'message': '解绑成功'}), 200


@auth_bp.route('/oauth/link/github', methods=['POST'])
@jwt_required()
def link_github():
    current_user_id = int(get_jwt_identity())
    data = request.get_json()
    code = data.get('code')
    
    if not code:
        return jsonify({'error': '缺少授权码'}), 400
    
    access_token = GitHubOAuth.get_access_token(code)
    if not access_token:
        return jsonify({'error': '获取访问令牌失败'}), 400
    
    user_info = GitHubOAuth.get_user_info(access_token)
    if not user_info:
        return jsonify({'error': '获取用户信息失败'}), 400
    
    success, error_msg = OAuthAccountManager.link_account(
        user_id=current_user_id,
        provider='github',
        provider_user_id=user_info['id'],
        access_token=access_token
    )
    
    if not success:
        return jsonify({'error': error_msg}), 400
    
    return jsonify({'message': '绑定成功', 'provider': 'github'}), 200


@auth_bp.route('/oauth/link/qq', methods=['POST'])
@jwt_required()
def link_qq():
    current_user_id = int(get_jwt_identity())
    data = request.get_json()
    code = data.get('code')
    
    if not code:
        return jsonify({'error': '缺少授权码'}), 400
    
    access_token = QQOAuth.get_access_token(code)
    if not access_token:
        return jsonify({'error': '获取访问令牌失败'}), 400
    
    open_id = QQOAuth.get_open_id(access_token)
    if not open_id:
        return jsonify({'error': '获取用户ID失败'}), 400
    
    success, error_msg = OAuthAccountManager.link_account(
        user_id=current_user_id,
        provider='qq',
        provider_user_id=open_id,
        access_token=access_token
    )
    
    if not success:
        return jsonify({'error': error_msg}), 400
    
    return jsonify({'message': '绑定成功', 'provider': 'qq'}), 200
