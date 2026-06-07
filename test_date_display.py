import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from datetime import datetime, date, time, timedelta
from app import create_app, get_local_tz, to_local_time, format_datetime_iso
from app.models import db, User, ProjectMeeting, Project, ProjectMember, CalendarEvent
from app.routes.calendar import _meeting_to_event, _generate_meeting_occurrences

def test_date_display():
    app = create_app()
    
    with app.app_context():
        print("=" * 60)
        print("日历日期显示测试")
        print("=" * 60)
        
        admin = User.query.filter_by(email='admin@example.com').first()
        if not admin:
            print("错误: 找不到管理员用户")
            return False
        
        local_tz = get_local_tz()
        print(f"\n当前时区: {local_tz.zone}")
        
        print("\n1. 测试会议日期转换...")
        
        test_date = date(2024, 6, 8)
        test_start_time = time(9, 0)
        test_end_time = time(10, 0)
        
        meeting = ProjectMeeting(
            id=999,
            project_id=1,
            title='测试会议',
            recurrence_type='once',
            start_time=test_start_time,
            end_time=test_end_time,
            start_date=test_date,
            created_by=admin.id
        )
        
        event = _meeting_to_event(meeting, test_date)
        
        start_time_str = event['start_time']
        start_dt = datetime.fromisoformat(start_time_str)
        
        print(f"   会议日期: {test_date}")
        print(f"   开始时间: {test_start_time}")
        print(f"   返回的 start_time: {start_time_str}")
        print(f"   解析后的本地日期: {start_dt.date()}")
        print(f"   解析后的本地时间: {start_dt.time()}")
        
        if start_dt.date() == test_date:
            print("   ✓ 日期正确")
        else:
            print("   ✗ 日期错误!")
            print(f"     期望: {test_date}, 实际: {start_dt.date()}")
            return False
        
        print("\n2. 测试普通事件日期转换...")
        
        utc_time = datetime(2024, 6, 8, 1, 0, 0)
        local_time = to_local_time(utc_time)
        print(f"   UTC 时间: {utc_time}")
        print(f"   本地时间: {local_time}")
        print(f"   本地日期: {local_time.date()}")
        
        print("\n3. 测试交付任务截止日期转换...")
        from app.routes.calendar import _delivery_to_event
        from app.models import DeliveryTask
        
        task = DeliveryTask(
            id=999,
            project_id=1,
            title='测试交付任务',
            deadline=datetime(2024, 6, 8, 1, 0, 0),
            created_by=admin.id
        )
        
        task_event = _delivery_to_event(task)
        task_start = datetime.fromisoformat(task_event['start_time'])
        print(f"   存储的 deadline (UTC): {task.deadline}")
        print(f"   返回的 start_time: {task_event['start_time']}")
        print(f"   解析后的本地日期: {task_start.date()}")
        
        print("\n" + "=" * 60)
        print("日期显示测试完成!")
        print("=" * 60)
        print("\n前端修复说明:")
        print("  - 日期格子的 data-date 现在使用本地日期字符串")
        print("  - 事件的 dateKey 现在使用本地日期")
        print("  - 前后端日期传递使用 YYYY-MM-DD 本地日期格式")
        print("  - 后端查询 UTC 时间时正确转换为本地日期范围")
        
        return True

if __name__ == '__main__':
    success = test_date_display()
    sys.exit(0 if success else 1)
