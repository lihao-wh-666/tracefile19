from flask import Flask, send_from_directory, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO
from datetime import datetime, timezone
import os
import pytz
import json

from config import Config
from app.models import db, bcrypt, jwt, User, IdeaCard, OperationLog
from app.services.reminder_scheduler import reminder_scheduler

socketio = SocketIO(cors_allowed_origins="*", async_mode='threading', logger=False, engineio_logger=False, ping_timeout=60, ping_interval=25)

def get_local_tz():
    return pytz.timezone(Config.TIMEZONE)

def to_local_time(dt):
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = pytz.UTC.localize(dt)
    local_tz = get_local_tz()
    return dt.astimezone(local_tz)

def format_datetime_iso(dt):
    if dt is None:
        return None
    local_dt = to_local_time(dt)
    return local_dt.isoformat()

def log_operation(operation_type, target_type, target_id=None, user_id=None, details=None, ip_address=None, user_agent=None):
    try:
        if details is not None and not isinstance(details, str):
            details = json.dumps(details, ensure_ascii=False)
        
        log = OperationLog(
            operation_type=operation_type,
            target_type=target_type,
            target_id=target_id,
            user_id=user_id,
            details=details,
            ip_address=ip_address,
            user_agent=user_agent
        )
        db.session.add(log)
        db.session.commit()
        return log
    except Exception as e:
        print(f"Error logging operation: {e}")
        db.session.rollback()
        return None

def log_operation_from_request(operation_type, target_type, target_id=None, user_id=None, details=None):
    try:
        ip_address = request.remote_addr
        if request.headers.get('X-Forwarded-For'):
            ip_address = request.headers.get('X-Forwarded-For').split(',')[0].strip()
        user_agent = request.headers.get('User-Agent', '')[:500]
        return log_operation(operation_type, target_type, target_id, user_id, details, ip_address, user_agent)
    except Exception as e:
        print(f"Error logging operation from request: {e}")
        return None

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_DIR = os.path.join(BASE_DIR, 'static')
TEMPLATE_DIR = os.path.join(BASE_DIR, 'templates')

def create_app(config_class=Config):
    app = Flask(__name__, static_folder=STATIC_DIR, template_folder=TEMPLATE_DIR)
    app.config.from_object(config_class)
    
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    
    CORS(app, supports_credentials=True)
    
    db.init_app(app)
    bcrypt.init_app(app)
    jwt.init_app(app)
    socketio.init_app(app)
    
    from app.routes.auth import auth_bp
    from app.routes.ideas import ideas_bp
    from app.routes.profile import profile_bp
    from app.routes.admin import admin_bp
    from app.routes.chat import chat_bp
    from app.routes.projects import projects_bp
    from app.routes.calendar import calendar_bp
    
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(ideas_bp, url_prefix='/api/ideas')
    app.register_blueprint(profile_bp, url_prefix='/api/profile')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(chat_bp, url_prefix='/api/chat')
    app.register_blueprint(projects_bp, url_prefix='/api/projects')
    app.register_blueprint(calendar_bp, url_prefix='/api/calendar')
    
    @app.route('/')
    def index():
        return send_from_directory(TEMPLATE_DIR, 'index.html')
    
    @app.route('/uploads/<path:filename>')
    def serve_uploads(filename):
        return send_from_directory(app.config['UPLOAD_FOLDER'], filename)
    
    @app.errorhandler(404)
    def not_found(e):
        if request.path.startswith('/api/'):
            return jsonify({'error': 'Not found'}), 404
        if request.path.startswith('/static/'):
            return 'Not found', 404
        return send_from_directory(TEMPLATE_DIR, 'index.html')
    
    from app import socket_events
    
    with app.app_context():
        db.create_all()
        create_admin_user()
        create_default_chat_room()
    
    reminder_scheduler.init_app(app)
    reminder_scheduler.start()
    
    return app

def create_admin_user():
    from flask import current_app
    from app.models import UserNotificationSettings, ChatRoom, ChatRoomMember
    admin_email = current_app.config['ADMIN_EMAIL']
    admin_password = current_app.config['ADMIN_PASSWORD']
    
    existing_admin = User.query.filter_by(email=admin_email).first()
    if not existing_admin:
        admin = User(
            username='admin',
            email=admin_email,
            role='admin',
            is_active=True
        )
        admin.set_password(admin_password)
        db.session.add(admin)
        db.session.flush()
        
        notify_settings = UserNotificationSettings(user_id=admin.id)
        db.session.add(notify_settings)
        
        db.session.commit()
        print(f'Admin user created: {admin_email}')
    else:
        if not existing_admin.notification_settings:
            notify_settings = UserNotificationSettings(user_id=existing_admin.id)
            db.session.add(notify_settings)
            db.session.commit()

def create_default_chat_room():
    from app.models import ChatRoom, ChatRoomMember
    default_room = ChatRoom.query.filter_by(name='开发者广场', type='group').first()
    if not default_room:
        admin = User.query.filter_by(role='admin').first()
        if admin:
            room = ChatRoom(
                name='开发者广场',
                type='group',
                created_by=admin.id
            )
            db.session.add(room)
            db.session.flush()
            
            member = ChatRoomMember(
                room_id=room.id,
                user_id=admin.id
            )
            db.session.add(member)
            db.session.commit()
            print('Default chat room created: 开发者广场')
