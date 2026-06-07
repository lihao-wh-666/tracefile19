import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from config import Config

db = SQLAlchemy()

def get_db_engine():
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)
    with app.app_context():
        return db.engine, app

def table_exists(engine, table_name):
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name=:table_name"),
            {"table_name": table_name}
        )
        return result.fetchone() is not None

def get_table_columns(engine, table_name):
    with engine.connect() as conn:
        result = conn.execute(text(f"PRAGMA table_info({table_name})"))
        return [row[1] for row in result.fetchall()]

def add_column_if_not_exists(engine, table_name, column_name, column_def):
    columns = get_table_columns(engine, table_name)
    if column_name in columns:
        print(f"   {column_name} 字段已存在")
        return False
    with engine.connect() as conn:
        conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_def}"))
        conn.commit()
    print(f"   ✓ {column_name} 字段添加成功")
    return True

def migrate_database():
    engine, temp_app = get_db_engine()
    
    print("开始数据库迁移...")
    
    try:
        user_table_exists = table_exists(engine, 'user')
        idea_card_table_exists = table_exists(engine, 'idea_card')
        
        if idea_card_table_exists:
            print("\n1. 检查并添加 IdeaCard 的软删除字段...")
            add_column_if_not_exists(engine, 'idea_card', 'is_deleted', 'BOOLEAN DEFAULT 0')
            add_column_if_not_exists(engine, 'idea_card', 'deleted_at', 'DATETIME')
            add_column_if_not_exists(engine, 'idea_card', 'deleted_by', 'INTEGER')
        else:
            print("\n1. IdeaCard 表不存在，将在后续步骤中创建")
        
        if user_table_exists:
            print("\n2. 检查并添加 User 的登录限制字段...")
            add_column_if_not_exists(engine, 'user', 'failed_login_attempts', 'INTEGER DEFAULT 0')
            add_column_if_not_exists(engine, 'user', 'last_failed_login_at', 'DATETIME')
        else:
            print("\n2. User 表不存在，将在后续步骤中创建")
        
        chat_room_table_exists = table_exists(engine, 'chat_room')
        if chat_room_table_exists:
            print("\n3. 检查并添加 ChatRoom 的项目相关字段...")
            add_column_if_not_exists(engine, 'chat_room', 'project_id', 'INTEGER')
            add_column_if_not_exists(engine, 'chat_room', 'channel_type', 'VARCHAR(50)')
        else:
            print("\n3. ChatRoom 表不存在，将在后续步骤中创建")
        
        calendar_event_table_exists = table_exists(engine, 'calendar_event')
        if calendar_event_table_exists:
            print("\n4. 检查日历事件相关的新表...")
            
            from app import create_app
            from app.models import db as main_db
            
            app = create_app()
            with app.app_context():
                print("   确保所有表已创建...")
                main_db.create_all()
                print("   ✓ 所有表已创建")
        else:
            print("\n4. CalendarEvent 表不存在，将在后续步骤中创建")
        
        from app import create_app
        from app.models import db as main_db
        
        app = create_app()
        with app.app_context():
            print("\n5. 确保所有表已创建...")
            main_db.create_all()
            print("   ✓ 所有表已创建")
        
        print("\n" + "=" * 60)
        print("数据库迁移完成！")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n✗ 迁移失败: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    return True

if __name__ == '__main__':
    success = migrate_database()
    sys.exit(0 if success else 1)
