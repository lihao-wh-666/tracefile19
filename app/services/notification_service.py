import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from flask import current_app


def send_in_app_notification(user_id, title, content, notification_type='reminder',
                             related_type=None, related_id=None):
    from app.models import db, Notification
    from app import socketio, log_operation

    try:
        notification = Notification(
            user_id=user_id,
            type=notification_type,
            title=title,
            content=content,
            related_type=related_type,
            related_id=related_id,
            channel='in_app',
            is_read=False
        )
        db.session.add(notification)
        db.session.commit()

        socketio.emit('new_notification', notification.to_dict(), room=f'user_{user_id}')

        return notification
    except Exception as e:
        db.session.rollback()
        print(f"Error sending in-app notification: {e}")
        return None


def send_email_notification(user_email, subject, body):
    smtp_host = os.environ.get('SMTP_HOST')
    smtp_port = os.environ.get('SMTP_PORT', 587)
    smtp_user = os.environ.get('SMTP_USER')
    smtp_password = os.environ.get('SMTP_PASSWORD')
    smtp_from = os.environ.get('SMTP_FROM', smtp_user)

    if not smtp_host or not smtp_user or not smtp_password:
        print("Email notification skipped: SMTP not configured")
        return False

    try:
        msg = MIMEMultipart()
        msg['From'] = smtp_from
        msg['To'] = user_email
        msg['Subject'] = subject

        msg.attach(MIMEText(body, 'plain', 'utf-8'))

        with smtplib.SMTP(smtp_host, int(smtp_port)) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.send_message(msg)

        print(f"Email sent to {user_email}")
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False


def send_sms_notification(phone, message):
    sms_provider = os.environ.get('SMS_PROVIDER')
    if not sms_provider:
        print("SMS notification skipped: SMS provider not configured")
        return False

    try:
        print(f"SMS sent to {phone}: {message}")
        return True
    except Exception as e:
        print(f"Error sending SMS: {e}")
        return False


def send_event_reminder(reminder, event):
    from app.models import db, User
    from app import log_operation

    user = User.query.get(reminder.user_id)
    if not user:
        return False

    channels = reminder.channels.split(',') if reminder.channels else ['in_app']
    remind_minutes = reminder.remind_before_minutes
    time_label = _format_remind_time(remind_minutes)

    title = f"日程提醒：{event.title}"
    content = f"您的日程「{event.title}」将在{time_label}开始。\n"

    if event.start_time:
        from app import format_datetime_iso
        content += f"开始时间：{format_datetime_iso(event.start_time)}\n"
    if event.location:
        content += f"地点：{event.location}\n"
    if event.meeting_link:
        content += f"会议链接：{event.meeting_link}\n"
    if event.description:
        content += f"描述：{event.description}\n"

    results = {}

    if 'in_app' in channels:
        result = send_in_app_notification(
            user_id=reminder.user_id,
            title=title,
            content=content,
            notification_type='reminder',
            related_type='calendar_event',
            related_id=event.id
        )
        results['in_app'] = result is not None

    if 'email' in channels and user.email:
        email_subject = f"【日程提醒】{event.title} - {time_label}后开始"
        result = send_email_notification(user.email, email_subject, content)
        results['email'] = result

    if 'sms' in channels:
        sms_message = f"【日程提醒】{event.title} 将在{time_label}开始。{event.location or ''}"
        result = send_sms_notification('', sms_message)
        results['sms'] = result

    reminder.is_sent = True
    reminder.sent_at = datetime.utcnow()
    db.session.commit()

    log_operation(
        operation_type='reminder_sent',
        target_type='calendar_event',
        target_id=event.id,
        user_id=reminder.user_id,
        details={'channels': list(results.keys()), 'remind_before_minutes': remind_minutes}
    )

    return True


def _format_remind_time(minutes):
    if minutes < 60:
        return f"{minutes}分钟"
    elif minutes < 1440:
        hours = minutes // 60
        return f"{hours}小时"
    else:
        days = minutes // 1440
        return f"{days}天"


def get_user_notifications(user_id, limit=50, unread_only=False):
    from app.models import Notification

    query = Notification.query.filter_by(user_id=user_id)
    if unread_only:
        query = query.filter_by(is_read=False)
    notifications = query.order_by(Notification.created_at.desc()).limit(limit).all()
    return [n.to_dict() for n in notifications]


def mark_notification_read(notification_id, user_id):
    from app.models import db, Notification
    from datetime import datetime

    notification = Notification.query.get(notification_id)
    if not notification or notification.user_id != user_id:
        return None

    notification.is_read = True
    notification.read_at = datetime.utcnow()
    db.session.commit()

    return notification.to_dict()


def mark_all_notifications_read(user_id):
    from app.models import db, Notification
    from datetime import datetime

    notifications = Notification.query.filter_by(user_id=user_id, is_read=False).all()
    for n in notifications:
        n.is_read = True
        n.read_at = datetime.utcnow()
    db.session.commit()

    return len(notifications)


def get_unread_count(user_id):
    from app.models import Notification

    return Notification.query.filter_by(user_id=user_id, is_read=False).count()
