from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager

db = SQLAlchemy()
bcrypt = Bcrypt()
jwt = JWTManager()


PROJECT_CHANNELS = [
    {'key': 'planning_chat', 'name': '策划闲聊', 'icon': '📋'},
    {'key': 'dev_discussion', 'name': '程序对接', 'icon': '💻'},
    {'key': 'art_request', 'name': '美术需求', 'icon': '🎨'},
    {'key': 'bug_report', 'name': 'BUG反馈', 'icon': '🐛'},
    {'key': 'temp_idea', 'name': '临时脑洞', 'icon': '💡'},
]


class Project(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, default='')
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    members = db.relationship('ProjectMember', backref='project', lazy=True, cascade='all, delete-orphan')
    channels = db.relationship('ChatRoom', backref='project', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self, current_user_id=None):
        from app import format_datetime_iso
        
        data = {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'created_by': self.created_by,
            'created_at': format_datetime_iso(self.created_at),
            'updated_at': format_datetime_iso(self.updated_at),
            'members_count': len(self.members),
        }
        
        if current_user_id:
            membership = ProjectMember.query.filter_by(
                project_id=self.id,
                user_id=current_user_id
            ).first()
            data['is_member'] = membership is not None
            data['role'] = membership.role if membership else None
        
        return data
    
    def get_channels(self):
        channels = []
        for ch in PROJECT_CHANNELS:
            room = ChatRoom.query.filter_by(
                project_id=self.id,
                channel_type=ch['key']
            ).first()
            if room:
                channel_data = room.to_dict()
                channel_data['channel_type'] = ch['key']
                channel_data['channel_name'] = ch['name']
                channel_data['channel_icon'] = ch['icon']
                channels.append(channel_data)
        return channels


class ProjectMember(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    role = db.Column(db.String(20), default='member')  # 'owner', 'admin', 'member'
    joined_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', backref='project_memberships')
    
    __table_args__ = (db.UniqueConstraint('project_id', 'user_id', name='_project_user_uc'),)
    
    def to_dict(self):
        from app import format_datetime_iso
        
        return {
            'id': self.id,
            'project_id': self.project_id,
            'user_id': self.user_id,
            'user': self.user.to_dict(),
            'role': self.role,
            'joined_at': format_datetime_iso(self.joined_at),
        }


class ChatRoom(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100))
    type = db.Column(db.String(20), default='group')  # 'group' or 'private' or 'project'
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=True)
    channel_type = db.Column(db.String(50), nullable=True)  # 项目频道类型
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    members = db.relationship('ChatRoomMember', backref='room', lazy=True, cascade='all, delete-orphan')
    messages = db.relationship('ChatMessage', backref='room', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self, current_user_id=None):
        from app import format_datetime_iso
        
        other_member = None
        if self.type == 'private' and current_user_id:
            for member in self.members:
                if member.user_id != current_user_id:
                    other_member = member.user
                    break
        
        data = {
            'id': self.id,
            'name': self.name or (other_member.username if other_member else '私聊'),
            'type': self.type,
            'project_id': self.project_id,
            'channel_type': self.channel_type,
            'created_by': self.created_by,
            'created_at': format_datetime_iso(self.created_at),
            'updated_at': format_datetime_iso(self.updated_at),
            'members_count': len(self.members),
            'last_message': self.messages[-1].to_dict() if self.messages else None
        }
        
        if self.type == 'private' and other_member:
            data['other_user'] = other_member.to_dict()
        
        return data


class ChatRoomMember(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    room_id = db.Column(db.Integer, db.ForeignKey('chat_room.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    joined_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_read_at = db.Column(db.DateTime)
    unread_count = db.Column(db.Integer, default=0)
    
    user = db.relationship('User', backref='chat_memberships')
    
    __table_args__ = (db.UniqueConstraint('room_id', 'user_id', name='_room_user_uc'),)
    
    def to_dict(self):
        from app import format_datetime_iso
        
        return {
            'id': self.id,
            'room_id': self.room_id,
            'user_id': self.user_id,
            'user': self.user.to_dict(),
            'joined_at': format_datetime_iso(self.joined_at),
            'last_read_at': format_datetime_iso(self.last_read_at),
            'unread_count': self.unread_count
        }


class ChatMessage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    room_id = db.Column(db.Integer, db.ForeignKey('chat_room.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    message_type = db.Column(db.String(20), default='text')  # 'text', 'system', 'image'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', backref='chat_messages')
    
    def to_dict(self):
        from app import format_datetime_iso
        
        return {
            'id': self.id,
            'room_id': self.room_id,
            'user_id': self.user_id,
            'user': self.user.to_dict(),
            'content': self.content,
            'message_type': self.message_type,
            'created_at': format_datetime_iso(self.created_at)
        }


class UserNotificationSettings(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    private_message_notify = db.Column(db.Boolean, default=True)
    group_message_notify = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = db.relationship('User', backref=db.backref('notification_settings', uselist=False))
    
    __table_args__ = (db.UniqueConstraint('user_id', name='_user_notify_uc'),)
    
    def to_dict(self):
        from app import format_datetime_iso
        
        return {
            'id': self.id,
            'user_id': self.user_id,
            'private_message_notify': self.private_message_notify,
            'group_message_notify': self.group_message_notify,
            'created_at': format_datetime_iso(self.created_at),
            'updated_at': format_datetime_iso(self.updated_at)
        }


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    avatar = db.Column(db.String(255), default='default.png')
    bio = db.Column(db.Text, default='')
    skills = db.Column(db.String(500), default='')
    role = db.Column(db.String(20), default='user')
    is_active = db.Column(db.Boolean, default=True)
    failed_login_attempts = db.Column(db.Integer, default=0)
    last_failed_login_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    ideas = db.relationship('IdeaCard', backref='author', lazy=True, cascade='all, delete-orphan', foreign_keys='IdeaCard.user_id')
    likes = db.relationship('Like', backref='user', lazy=True, cascade='all, delete-orphan')
    comments = db.relationship('Comment', foreign_keys='Comment.user_id', backref='author', lazy=True, cascade='all, delete-orphan')
    replies_received = db.relationship('Comment', foreign_keys='Comment.reply_to_user_id', back_populates='reply_to_user', lazy=True)
    
    def set_password(self, password):
        self.password_hash = bcrypt.generate_password_hash(password).decode('utf-8')
    
    def check_password(self, password):
        return bcrypt.check_password_hash(self.password_hash, password)
    
    def is_login_locked(self, max_attempts=5, window_minutes=30):
        if self.failed_login_attempts >= max_attempts and self.last_failed_login_at:
            time_since_last_failure = datetime.utcnow() - self.last_failed_login_at
            if time_since_last_failure.total_seconds() < window_minutes * 60:
                return True
        return False
    
    def get_lock_remaining_seconds(self, window_minutes=30):
        if not self.last_failed_login_at:
            return 0
        elapsed = (datetime.utcnow() - self.last_failed_login_at).total_seconds()
        remaining = window_minutes * 60 - elapsed
        return max(0, int(remaining))
    
    def increment_failed_attempts(self):
        self.failed_login_attempts += 1
        self.last_failed_login_at = datetime.utcnow()
    
    def reset_failed_attempts(self):
        self.failed_login_attempts = 0
        self.last_failed_login_at = None
    
    def get_notification_settings(self):
        settings = UserNotificationSettings.query.filter_by(user_id=self.id).first()
        if not settings:
            settings = UserNotificationSettings(user_id=self.id)
            db.session.add(settings)
            db.session.commit()
        return settings
    
    def to_dict(self, include_email=False):
        data = {
            'id': self.id,
            'username': self.username,
            'avatar': self.avatar,
            'bio': self.bio,
            'skills': self.skills,
            'role': self.role,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
        if include_email:
            data['email'] = self.email
            data['is_active'] = self.is_active
            data['updated_at'] = self.updated_at.isoformat() if self.updated_at else None
        return data


class IdeaCard(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(50), default='general')
    tags = db.Column(db.String(500), default='')
    image_url = db.Column(db.String(255))
    is_public = db.Column(db.Boolean, default=True)
    status = db.Column(db.String(20), default='draft')
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_deleted = db.Column(db.Boolean, default=False)
    deleted_at = db.Column(db.DateTime)
    deleted_by = db.Column(db.Integer, db.ForeignKey('user.id'))
    
    likes = db.relationship('Like', backref='idea', lazy=True, cascade='all, delete-orphan')
    comments = db.relationship('Comment', backref='idea', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self, include_user=True):
        from app import format_datetime_iso
        data = {
            'id': self.id,
            'title': self.title,
            'content': self.content,
            'category': self.category,
            'tags': self.tags,
            'image_url': self.image_url,
            'is_public': self.is_public,
            'status': self.status,
            'user_id': self.user_id,
            'likes_count': len(self.likes),
            'comments_count': len(self.comments),
            'is_deleted': self.is_deleted,
            'deleted_at': format_datetime_iso(self.deleted_at) if self.deleted_at else None,
            'deleted_by': self.deleted_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        if include_user and self.author:
            data['author'] = self.author.to_dict()
        return data


class Like(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    idea_id = db.Column(db.Integer, db.ForeignKey('idea_card.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    __table_args__ = (db.UniqueConstraint('user_id', 'idea_id', name='_user_idea_uc'),)


class Comment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    idea_id = db.Column(db.Integer, db.ForeignKey('idea_card.id'), nullable=False)
    parent_id = db.Column(db.Integer, db.ForeignKey('comment.id'))
    reply_to_user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    replies = db.relationship('Comment', backref=db.backref('parent', remote_side=[id]), lazy=True, cascade='all, delete-orphan')
    reply_to_user = db.relationship('User', foreign_keys=[reply_to_user_id], back_populates='replies_received')
    
    def to_dict(self):
        data = {
            'id': self.id,
            'content': self.content,
            'user_id': self.user_id,
            'idea_id': self.idea_id,
            'parent_id': self.parent_id,
            'reply_to_user_id': self.reply_to_user_id,
            'author': self.author.to_dict(),
            'replies': [reply.to_dict() for reply in self.replies],
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        if self.reply_to_user:
            data['reply_to_user'] = self.reply_to_user.to_dict()
        return data


class OperationLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    operation_type = db.Column(db.String(50), nullable=False)
    target_type = db.Column(db.String(50), nullable=False)
    target_id = db.Column(db.Integer)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    details = db.Column(db.Text)
    ip_address = db.Column(db.String(50))
    user_agent = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref='operation_logs', foreign_keys=[user_id])

    def to_dict(self):
        from app import format_datetime_iso
        import json
        try:
            details = json.loads(self.details) if self.details else None
        except Exception:
            details = self.details

        return {
            'id': self.id,
            'operation_type': self.operation_type,
            'target_type': self.target_type,
            'target_id': self.target_id,
            'user_id': self.user_id,
            'user': self.user.to_dict() if self.user else None,
            'details': details,
            'ip_address': self.ip_address,
            'user_agent': self.user_agent,
            'created_at': format_datetime_iso(self.created_at)
        }


class ProjectMeeting(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, default='')
    recurrence_type = db.Column(db.String(20), default='weekly')  # 'daily', 'weekly', 'monthly', 'once'
    recurrence_day = db.Column(db.Integer)  # 周几(0-6)或每月几号(1-31)
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)
    location = db.Column(db.String(500), default='')
    meeting_link = db.Column(db.String(500), default='')
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date)
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)

    project = db.relationship('Project', backref='meetings')
    creator = db.relationship('User', backref='created_meetings', foreign_keys=[created_by])

    def to_dict(self):
        from app import format_datetime_iso
        
        return {
            'id': self.id,
            'project_id': self.project_id,
            'project_name': self.project.name if self.project else '',
            'title': self.title,
            'description': self.description,
            'recurrence_type': self.recurrence_type,
            'recurrence_day': self.recurrence_day,
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'location': self.location,
            'meeting_link': self.meeting_link,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'created_by': self.created_by,
            'creator': self.creator.to_dict() if self.creator else None,
            'created_at': format_datetime_iso(self.created_at),
            'updated_at': format_datetime_iso(self.updated_at),
            'is_active': self.is_active
        }


class DeliveryTask(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, default='')
    resource_type = db.Column(db.String(50), default='general')  # 'art', 'code', 'document', 'sound', 'general'
    deadline = db.Column(db.DateTime, nullable=False)
    assignee_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    status = db.Column(db.String(20), default='pending')  # 'pending', 'in_progress', 'completed', 'delayed'
    priority = db.Column(db.String(20), default='medium')  # 'low', 'medium', 'high', 'urgent'
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = db.relationship('Project', backref='delivery_tasks')
    assignee = db.relationship('User', backref='assigned_deliveries', foreign_keys=[assignee_id])
    creator = db.relationship('User', backref='created_deliveries', foreign_keys=[created_by])

    def to_dict(self):
        from app import format_datetime_iso
        
        return {
            'id': self.id,
            'project_id': self.project_id,
            'project_name': self.project.name if self.project else '',
            'title': self.title,
            'description': self.description,
            'resource_type': self.resource_type,
            'deadline': format_datetime_iso(self.deadline),
            'assignee_id': self.assignee_id,
            'assignee': self.assignee.to_dict() if self.assignee else None,
            'status': self.status,
            'priority': self.priority,
            'created_by': self.created_by,
            'creator': self.creator.to_dict() if self.creator else None,
            'created_at': format_datetime_iso(self.created_at),
            'updated_at': format_datetime_iso(self.updated_at)
        }


class CalendarEvent(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'))
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, default='')
    event_type = db.Column(db.String(30), default='general')  # 'meeting', 'delivery', 'general', 'reminder'
    event_source_id = db.Column(db.Integer)  # 关联的源ID（会议ID、交付任务ID等）
    start_time = db.Column(db.DateTime, nullable=False)
    end_time = db.Column(db.DateTime, nullable=False)
    location = db.Column(db.String(500), default='')
    meeting_link = db.Column(db.String(500), default='')
    color = db.Column(db.String(20), default='#6366f1')
    is_all_day = db.Column(db.Boolean, default=False)
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = db.relationship('Project', backref='calendar_events')
    creator = db.relationship('User', backref='calendar_events', foreign_keys=[created_by])

    __table_args__ = (
        db.Index('idx_calendar_event_time', 'start_time', 'end_time'),
        db.Index('idx_calendar_event_project', 'project_id'),
        db.Index('idx_calendar_event_type', 'event_type'),
    )

    def to_dict(self):
        from app import format_datetime_iso
        
        return {
            'id': self.id,
            'project_id': self.project_id,
            'project_name': self.project.name if self.project else '',
            'title': self.title,
            'description': self.description,
            'event_type': self.event_type,
            'event_source_id': self.event_source_id,
            'start_time': format_datetime_iso(self.start_time),
            'end_time': format_datetime_iso(self.end_time),
            'location': self.location,
            'meeting_link': self.meeting_link,
            'color': self.color,
            'is_all_day': self.is_all_day,
            'created_by': self.created_by,
            'creator': self.creator.to_dict() if self.creator else None,
            'created_at': format_datetime_iso(self.created_at),
            'updated_at': format_datetime_iso(self.updated_at)
        }
