import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from datetime import datetime, timedelta
from app import create_app
from app.models import db, User, Project, ProjectMember, CalendarEvent, CalendarEventMember, EventReminder, Notification
from app.services.notification_service import send_in_app_notification, get_user_notifications, mark_notification_read, mark_all_notifications_read, get_unread_count, send_event_reminder

def test_reminder_features():
    app = create_app()
    
    with app.app_context():
        print("=" * 60)
        print("成员提醒绑定功能测试")
        print("=" * 60)
        
        admin = User.query.filter_by(email='admin@example.com').first()
        if not admin:
            print("错误: 找不到管理员用户")
            return False
        
        print(f"\n1. 使用测试用户: {admin.username} (ID: {admin.id})")
        
        print("\n2. 测试创建日历事件...")
        event = CalendarEvent(
            title='测试日程事件',
            description='这是一个用于测试的日程事件',
            event_type='general',
            start_time=datetime.utcnow() + timedelta(hours=2),
            end_time=datetime.utcnow() + timedelta(hours=3),
            location='会议室A',
            meeting_link='https://meet.example.com/123',
            created_by=admin.id
        )
        db.session.add(event)
        db.session.commit()
        print(f"   ✓ 事件创建成功 (ID: {event.id})")
        
        print("\n3. 测试添加事件成员...")
        member = CalendarEventMember(
            event_id=event.id,
            user_id=admin.id,
            added_by=admin.id
        )
        db.session.add(member)
        db.session.commit()
        print(f"   ✓ 成员添加成功 (ID: {member.id})")
        
        members = CalendarEventMember.query.filter_by(event_id=event.id).all()
        print(f"   当前事件成员数: {len(members)}")
        
        print("\n4. 测试创建提醒...")
        reminder = EventReminder(
            event_id=event.id,
            user_id=admin.id,
            remind_before_minutes=60,
            channels='in_app,email',
            is_sent=False
        )
        db.session.add(reminder)
        db.session.commit()
        print(f"   ✓ 提醒创建成功 (ID: {reminder.id})")
        print(f"     提醒时间: 提前 {reminder.remind_before_minutes} 分钟")
        print(f"     提醒渠道: {reminder.channels}")
        
        reminders = EventReminder.query.filter_by(event_id=event.id, user_id=admin.id).all()
        print(f"   当前提醒数: {len(reminders)}")
        
        print("\n5. 测试发送系统内通知...")
        notification = send_in_app_notification(
            user_id=admin.id,
            title='测试通知',
            content='这是一条测试通知消息',
            notification_type='reminder',
            related_type='calendar_event',
            related_id=event.id
        )
        if notification:
            print(f"   ✓ 通知发送成功 (ID: {notification.id})")
        else:
            print("   ✗ 通知发送失败")
            return False
        
        print("\n6. 测试获取通知列表...")
        notifications = get_user_notifications(admin.id)
        print(f"   ✓ 获取到 {len(notifications)} 条通知")
        if notifications:
            print(f"     最新通知: {notifications[0]['title']}")
        
        print("\n7. 测试未读计数...")
        unread_count = get_unread_count(admin.id)
        print(f"   ✓ 未读通知数: {unread_count}")
        
        print("\n8. 测试标记通知已读...")
        if notifications:
            result = mark_notification_read(notifications[0]['id'], admin.id)
            if result and result['is_read']:
                print(f"   ✓ 通知已标记为已读")
            else:
                print("   ✗ 标记已读失败")
        
        print("\n9. 测试标记所有通知已读...")
        count = mark_all_notifications_read(admin.id)
        print(f"   ✓ 已标记 {count} 条通知为已读")
        
        unread_after = get_unread_count(admin.id)
        print(f"     剩余未读数: {unread_after}")
        
        print("\n10. 测试查询事件成员...")
        event_members = CalendarEventMember.query.filter_by(event_id=event.id).all()
        for m in event_members:
            print(f"    - 成员: {m.user.username} (ID: {m.user_id})")
        
        print("\n11. 测试查询用户的所有提醒...")
        user_reminders = EventReminder.query.filter_by(user_id=admin.id).all()
        print(f"    共有 {len(user_reminders)} 个提醒设置")
        for r in user_reminders:
            event_title = r.event.title if r.event else '未知事件'
            print(f"    - {event_title}: 提前 {r.remind_before_minutes} 分钟")
        
        print("\n" + "=" * 60)
        print("所有测试通过! ✓")
        print("=" * 60)
        
        return True

if __name__ == '__main__':
    success = test_reminder_features()
    sys.exit(0 if success else 1)
