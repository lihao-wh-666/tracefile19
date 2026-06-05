from flask import Blueprint, request, jsonify, make_response
from flask_jwt_extended import jwt_required, get_jwt_identity
from functools import wraps
from io import BytesIO
from datetime import datetime
import pandas as pd
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os
from app.models import db, User, IdeaCard, Like, Comment, OperationLog
from app.rsa_utils import decrypt_rsa
from app import log_operation_from_request

admin_bp = Blueprint('admin', __name__)

def admin_required(fn):
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)
        if not user or user.role != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        return fn(*args, **kwargs)
    return wrapper


@admin_bp.route('/stats', methods=['GET'])
@admin_required
def get_stats():
    total_users = User.query.count()
    total_ideas = IdeaCard.query.count()
    total_likes = Like.query.count()
    total_comments = Comment.query.count()
    
    new_users_today = User.query.filter(
        db.func.date(User.created_at) == db.func.date(db.func.now())
    ).count()
    
    new_ideas_today = IdeaCard.query.filter(
        db.func.date(IdeaCard.created_at) == db.func.date(db.func.now())
    ).count()
    
    active_users = User.query.filter(User.is_active == True).count()
    inactive_users = User.query.filter(User.is_active == False).count()
    
    return jsonify({
        'total_users': total_users,
        'total_ideas': total_ideas,
        'total_likes': total_likes,
        'total_comments': total_comments,
        'new_users_today': new_users_today,
        'new_ideas_today': new_ideas_today,
        'active_users': active_users,
        'inactive_users': inactive_users
    }), 200


@admin_bp.route('/users', methods=['POST'])
@admin_required
def create_user():
    current_user_id = int(get_jwt_identity())
    data = request.get_json()
    
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    role = data.get('role', 'user')
    bio = data.get('bio', '')
    skills = data.get('skills', '')
    
    if not username or not email or not password:
        return jsonify({'error': 'Username, email and password are required'}), 400
    
    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Username already exists'}), 400
    
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already exists'}), 400
    
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400
    
    if role not in ['user', 'admin']:
        return jsonify({'error': 'Invalid role'}), 400
    
    user = User(
        username=username,
        email=email,
        role=role,
        bio=bio,
        skills=skills,
        is_active=True
    )
    user.set_password(password)
    
    db.session.add(user)
    db.session.flush()
    
    from app.models import UserNotificationSettings
    notify_settings = UserNotificationSettings(user_id=user.id)
    db.session.add(notify_settings)
    
    db.session.commit()
    
    log_operation_from_request(
        operation_type='admin_create',
        target_type='user',
        target_id=user.id,
        user_id=current_user_id,
        details={'username': user.username, 'email': user.email, 'role': user.role}
    )
    
    return jsonify({
        'message': 'User created successfully',
        'user': user.to_dict(include_email=True)
    }), 201


@admin_bp.route('/users', methods=['GET'])
@admin_required
def list_users():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    search = request.args.get('search', '')
    role = request.args.get('role', '')
    status = request.args.get('status', '')
    
    query = User.query
    
    if search:
        query = query.filter(
            (User.username.ilike(f'%{search}%')) |
            (User.email.ilike(f'%{search}%')) |
            (User.bio.ilike(f'%{search}%'))
        )
    
    if role:
        query = query.filter(User.role == role)
    
    if status:
        if status == 'active':
            query = query.filter(User.is_active == True)
        elif status == 'inactive':
            query = query.filter(User.is_active == False)
    
    pagination = query.order_by(User.created_at.desc()).paginate(page=page, per_page=per_page)
    
    return jsonify({
        'users': [user.to_dict(include_email=True) for user in pagination.items],
        'total': pagination.total,
        'pages': pagination.pages,
        'page': page,
        'per_page': per_page
    }), 200


@admin_bp.route('/users/<int:user_id>', methods=['GET'])
@admin_required
def get_user(user_id):
    from flask import current_app
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    user_data = user.to_dict(include_email=True)
    user_data['ideas_count'] = IdeaCard.query.filter_by(user_id=user_id).count()
    user_data['likes_count'] = Like.query.filter_by(user_id=user_id).count()
    user_data['comments_count'] = Comment.query.filter_by(user_id=user_id).count()
    
    max_attempts = current_app.config.get('MAX_LOGIN_ATTEMPTS', 5)
    lock_window = current_app.config.get('LOGIN_LOCK_WINDOW_MINUTES', 30)
    
    user_data['failed_login_attempts'] = user.failed_login_attempts
    user_data['is_login_locked'] = user.is_login_locked(max_attempts, lock_window)
    user_data['lock_remaining_seconds'] = user.get_lock_remaining_seconds(lock_window)
    
    from app import format_datetime_iso
    user_data['last_failed_login_at'] = format_datetime_iso(user.last_failed_login_at) if user.last_failed_login_at else None
    
    return jsonify({'user': user_data}), 200


@admin_bp.route('/users/<int:user_id>', methods=['PUT'])
@admin_required
def update_user(user_id):
    current_user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    
    old_values = {}
    new_values = {}
    
    if 'username' in data:
        existing = User.query.filter(User.username == data['username'], User.id != user_id).first()
        if existing:
            return jsonify({'error': 'Username already exists'}), 400
        old_values['username'] = user.username
        new_values['username'] = data['username']
        user.username = data['username']
    
    if 'email' in data:
        existing = User.query.filter(User.email == data['email'], User.id != user_id).first()
        if existing:
            return jsonify({'error': 'Email already exists'}), 400
        old_values['email'] = user.email
        new_values['email'] = data['email']
        user.email = data['email']
    
    if 'role' in data:
        if data['role'] in ['user', 'admin']:
            old_values['role'] = user.role
            new_values['role'] = data['role']
            user.role = data['role']
    
    if 'is_active' in data:
        old_values['is_active'] = user.is_active
        new_values['is_active'] = data['is_active']
        user.is_active = data['is_active']
    
    if 'bio' in data:
        old_values['bio'] = user.bio
        new_values['bio'] = data['bio']
        user.bio = data['bio']
    
    if 'skills' in data:
        old_values['skills'] = user.skills
        new_values['skills'] = data['skills']
        user.skills = data['skills']
    
    db.session.commit()
    
    if old_values:
        log_operation_from_request(
            operation_type='admin_update',
            target_type='user',
            target_id=user_id,
            user_id=current_user_id,
            details={'old': old_values, 'new': new_values}
        )
    
    return jsonify({
        'message': 'User updated successfully',
        'user': user.to_dict(include_email=True)
    }), 200


@admin_bp.route('/users/<int:user_id>', methods=['DELETE'])
@admin_required
def delete_user(user_id):
    current_user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    if user.role == 'admin':
        admin_count = User.query.filter_by(role='admin').count()
        if admin_count <= 1:
            return jsonify({'error': 'Cannot delete the last admin user'}), 400
    
    username = user.username
    email = user.email
    
    db.session.delete(user)
    db.session.commit()
    
    log_operation_from_request(
        operation_type='admin_delete',
        target_type='user',
        target_id=user_id,
        user_id=current_user_id,
        details={'username': username, 'email': email}
    )
    
    return jsonify({'message': 'User deleted successfully'}), 200


@admin_bp.route('/users/<int:user_id>/reset-password', methods=['POST'])
@admin_required
def reset_user_password(user_id):
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    encrypted_new_password = data.get('new_password')
    
    if not encrypted_new_password:
        return jsonify({'error': 'New password is required'}), 400
    
    new_password = decrypt_rsa(encrypted_new_password)
    if not new_password:
        return jsonify({'error': 'Password decryption failed'}), 400
    
    if len(new_password) < 6:
        return jsonify({'error': 'New password must be at least 6 characters'}), 400
    
    user.set_password(new_password)
    user.reset_failed_attempts()
    db.session.commit()
    
    return jsonify({'message': 'Password reset successfully'}), 200


@admin_bp.route('/users/<int:user_id>/unlock', methods=['POST'])
@admin_required
def unlock_user(user_id):
    current_user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    user.reset_failed_attempts()
    db.session.commit()
    
    log_operation_from_request(
        operation_type='admin_unlock',
        target_type='user',
        target_id=user_id,
        user_id=current_user_id,
        details={'username': user.username, 'email': user.email}
    )
    
    return jsonify({'message': 'User login attempts reset successfully'}), 200


@admin_bp.route('/ideas', methods=['GET'])
@admin_required
def list_all_ideas():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    search = request.args.get('search', '')
    status = request.args.get('status', '')
    user_id = request.args.get('user_id', type=int)
    include_deleted = request.args.get('include_deleted', 'false').lower() == 'true'
    only_deleted = request.args.get('only_deleted', 'false').lower() == 'true'
    
    query = IdeaCard.query
    
    if not include_deleted and not only_deleted:
        query = query.filter(IdeaCard.is_deleted == False)
    elif only_deleted:
        query = query.filter(IdeaCard.is_deleted == True)
    
    if search:
        query = query.filter(
            (IdeaCard.title.ilike(f'%{search}%')) |
            (IdeaCard.content.ilike(f'%{search}%'))
        )
    
    if status:
        query = query.filter(IdeaCard.status == status)
    
    if user_id:
        query = query.filter(IdeaCard.user_id == user_id)
    
    pagination = query.order_by(IdeaCard.created_at.desc()).paginate(page=page, per_page=per_page)
    
    return jsonify({
        'ideas': [idea.to_dict() for idea in pagination.items],
        'total': pagination.total,
        'pages': pagination.pages,
        'page': page,
        'per_page': per_page
    }), 200


@admin_bp.route('/ideas/<int:idea_id>', methods=['PUT'])
@admin_required
def update_idea_admin(idea_id):
    current_user_id = int(get_jwt_identity())
    idea = IdeaCard.query.get(idea_id)
    
    if not idea:
        return jsonify({'error': 'Idea not found'}), 404
    
    data = request.get_json()
    
    old_values = {}
    new_values = {}
    
    if 'status' in data:
        old_values['status'] = idea.status
        new_values['status'] = data['status']
        idea.status = data['status']
    if 'is_public' in data:
        old_values['is_public'] = idea.is_public
        new_values['is_public'] = data['is_public']
        idea.is_public = data['is_public']
    
    db.session.commit()
    
    if old_values:
        log_operation_from_request(
            operation_type='admin_update',
            target_type='idea',
            target_id=idea_id,
            user_id=current_user_id,
            details={'old': old_values, 'new': new_values, 'idea_title': idea.title}
        )
    
    return jsonify({
        'message': 'Idea updated successfully',
        'idea': idea.to_dict()
    }), 200


@admin_bp.route('/ideas/<int:idea_id>', methods=['DELETE'])
@admin_required
def delete_idea_admin(idea_id):
    current_user_id = int(get_jwt_identity())
    idea = IdeaCard.query.get(idea_id)
    
    if not idea:
        return jsonify({'error': 'Idea not found'}), 404
    
    idea.is_deleted = True
    idea.deleted_at = datetime.utcnow()
    idea.deleted_by = current_user_id
    db.session.commit()
    
    log_operation_from_request(
        operation_type='admin_delete',
        target_type='idea',
        target_id=idea_id,
        user_id=current_user_id,
        details={'title': idea.title, 'content_preview': idea.content[:200] if idea.content else ''}
    )
    
    return jsonify({'message': 'Idea deleted successfully'}), 200


@admin_bp.route('/users/export/<format>', methods=['GET'])
@admin_required
def export_users(format):
    search = request.args.get('search', '')
    role = request.args.get('role', '')
    status = request.args.get('status', '')
    
    query = User.query
    
    if search:
        query = query.filter(
            (User.username.ilike(f'%{search}%')) |
            (User.email.ilike(f'%{search}%')) |
            (User.bio.ilike(f'%{search}%'))
        )
    
    if role:
        query = query.filter(User.role == role)
    
    if status:
        if status == 'active':
            query = query.filter(User.is_active == True)
        elif status == 'inactive':
            query = query.filter(User.is_active == False)
    
    users = query.order_by(User.created_at.desc()).all()
    
    from app import format_datetime_iso
    
    users_data = []
    for user in users:
        users_data.append({
            'ID': user.id,
            '用户名': user.username,
            '邮箱': user.email,
            '角色': '管理员' if user.role == 'admin' else '普通用户',
            '状态': '激活' if user.is_active else '禁用',
            '创建时间': format_datetime_iso(user.created_at).replace('T', ' ') if user.created_at else '',
            '更新时间': format_datetime_iso(user.updated_at).replace('T', ' ') if user.updated_at else ''
        })
    
    format = format.lower()
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f'users_{timestamp}'
    
    if format == 'csv':
        return export_csv(users_data, filename)
    elif format == 'excel':
        return export_excel(users_data, filename)
    elif format == 'pdf':
        return export_pdf(users_data, filename)
    else:
        return jsonify({'error': 'Unsupported format. Use csv, excel, or pdf'}), 400


def export_csv(data, filename):
    df = pd.DataFrame(data)
    output = BytesIO()
    df.to_csv(output, index=False, encoding='utf-8-sig')
    output.seek(0)
    
    response = make_response(output.getvalue())
    response.headers["Content-Disposition"] = f"attachment; filename={filename}.csv"
    response.headers["Content-type"] = "text/csv"
    return response


def export_excel(data, filename):
    df = pd.DataFrame(data)
    output = BytesIO()
    
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='用户列表')
    
    output.seek(0)
    
    response = make_response(output.getvalue())
    response.headers["Content-Disposition"] = f"attachment; filename={filename}.xlsx"
    response.headers["Content-type"] = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    return response


def export_pdf(data, filename):
    output = BytesIO()
    doc = SimpleDocTemplate(output, pagesize=A4, rightMargin=2*cm, leftMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)
    elements = []
    
    font_name = 'Helvetica'
    try:
        font_paths = [
            '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc',
            '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',
            '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
            'C:/Windows/Fonts/msyh.ttc',
            'C:/Windows/Fonts/simhei.ttf',
            'C:/Windows/Fonts/simsun.ttc',
        ]
        
        for font_path in font_paths:
            if os.path.exists(font_path):
                pdfmetrics.registerFont(TTFont('ChineseFont', font_path))
                font_name = 'ChineseFont'
                break
    except Exception:
        pass
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontName=font_name,
        fontSize=18,
        spaceAfter=30,
        alignment=1
    )
    
    normal_style = ParagraphStyle(
        'ChineseNormal',
        parent=styles['Normal'],
        fontName=font_name,
        fontSize=10
    )
    
    elements.append(Paragraph('用户列表', title_style))
    elements.append(Paragraph(f'导出时间: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}', normal_style))
    elements.append(Paragraph('', normal_style))
    
    if data:
        table_data = [list(data[0].keys())]
        for row in data:
            table_data.append([str(v) for v in row.values()])
        
        col_widths = [1*cm, 2.5*cm, 3.5*cm, 2*cm, 1.5*cm, 2.8*cm, 2.8*cm]
        
        table = Table(table_data, colWidths=col_widths)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, -1), font_name),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        
        elements.append(table)
    else:
        elements.append(Paragraph('没有用户数据', normal_style))
    
    doc.build(elements)
    output.seek(0)
    
    response = make_response(output.getvalue())
    response.headers["Content-Disposition"] = f"attachment; filename={filename}.pdf"
    response.headers["Content-type"] = "application/pdf"
    return response


@admin_bp.route('/ideas/<int:idea_id>/restore', methods=['POST'])
@admin_required
def restore_idea(idea_id):
    current_user_id = int(get_jwt_identity())
    idea = IdeaCard.query.get(idea_id)
    
    if not idea:
        return jsonify({'error': 'Idea not found'}), 404
    
    if not idea.is_deleted:
        return jsonify({'error': 'Idea is not deleted'}), 400
    
    idea.is_deleted = False
    idea.deleted_at = None
    idea.deleted_by = None
    db.session.commit()
    
    log_operation_from_request(
        operation_type='restore',
        target_type='idea',
        target_id=idea_id,
        user_id=current_user_id,
        details={'title': idea.title}
    )
    
    return jsonify({
        'message': 'Idea restored successfully',
        'idea': idea.to_dict()
    }), 200


@admin_bp.route('/ideas/<int:idea_id>/permanent', methods=['DELETE'])
@admin_required
def permanently_delete_idea(idea_id):
    current_user_id = int(get_jwt_identity())
    idea = IdeaCard.query.get(idea_id)
    
    if not idea:
        return jsonify({'error': 'Idea not found'}), 404
    
    idea_title = idea.title
    idea_content = idea.content[:200] if idea.content else ''
    
    db.session.delete(idea)
    db.session.commit()
    
    log_operation_from_request(
        operation_type='permanent_delete',
        target_type='idea',
        target_id=idea_id,
        user_id=current_user_id,
        details={'title': idea_title, 'content_preview': idea_content}
    )
    
    return jsonify({'message': 'Idea permanently deleted'}), 200


@admin_bp.route('/operation-logs', methods=['GET'])
@admin_required
def get_operation_logs():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    operation_type = request.args.get('operation_type', '')
    target_type = request.args.get('target_type', '')
    user_id = request.args.get('user_id', type=int)
    target_id = request.args.get('target_id', type=int)
    start_date = request.args.get('start_date', '')
    end_date = request.args.get('end_date', '')
    
    query = OperationLog.query
    
    if operation_type:
        query = query.filter(OperationLog.operation_type == operation_type)
    
    if target_type:
        query = query.filter(OperationLog.target_type == target_type)
    
    if user_id:
        query = query.filter(OperationLog.user_id == user_id)
    
    if target_id:
        query = query.filter(OperationLog.target_id == target_id)
    
    if start_date:
        try:
            start_dt = datetime.strptime(start_date, '%Y-%m-%d')
            query = query.filter(OperationLog.created_at >= start_dt)
        except ValueError:
            pass
    
    if end_date:
        try:
            end_dt = datetime.strptime(end_date, '%Y-%m-%d')
            end_dt = end_dt.replace(hour=23, minute=59, second=59)
            query = query.filter(OperationLog.created_at <= end_dt)
        except ValueError:
            pass
    
    pagination = query.order_by(OperationLog.created_at.desc()).paginate(page=page, per_page=per_page)
    
    return jsonify({
        'logs': [log.to_dict() for log in pagination.items],
        'total': pagination.total,
        'pages': pagination.pages,
        'page': page,
        'per_page': per_page
    }), 200


@admin_bp.route('/operation-logs/<int:log_id>', methods=['GET'])
@admin_required
def get_operation_log(log_id):
    log = OperationLog.query.get(log_id)
    
    if not log:
        return jsonify({'error': 'Log not found'}), 404
    
    return jsonify({'log': log.to_dict()}), 200


@admin_bp.route('/operation-logs/types', methods=['GET'])
@admin_required
def get_operation_log_types():
    operation_types = db.session.query(
        OperationLog.operation_type,
        db.func.count(OperationLog.id).label('count')
    ).group_by(OperationLog.operation_type).all()
    
    target_types = db.session.query(
        OperationLog.target_type,
        db.func.count(OperationLog.id).label('count')
    ).group_by(OperationLog.target_type).all()
    
    return jsonify({
        'operation_types': [{'type': t, 'count': c} for t, c in operation_types],
        'target_types': [{'type': t, 'count': c} for t, c in target_types]
    }), 200
