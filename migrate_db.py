import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from app.models import db
from sqlalchemy import text

def migrate_database():
    app = create_app()
    
    with app.app_context():
        print("开始数据库迁移...")
        
        try:
            print("\n1. 检查并添加 IdeaCard 的软删除字段...")
            
            with db.engine.connect() as conn:
                result = conn.execute(text("PRAGMA table_info(idea_card)"))
                columns = [row[1] for row in result.fetchall()]
                
                if 'is_deleted' in columns:
                    print("   is_deleted 字段已存在")
                else:
                    print("   添加 is_deleted 字段...")
                    conn.execute(text("ALTER TABLE idea_card ADD COLUMN is_deleted BOOLEAN DEFAULT 0"))
                    print("   ✓ is_deleted 字段添加成功")
                
                if 'deleted_at' in columns:
                    print("   deleted_at 字段已存在")
                else:
                    print("   添加 deleted_at 字段...")
                    conn.execute(text("ALTER TABLE idea_card ADD COLUMN deleted_at DATETIME"))
                    print("   ✓ deleted_at 字段添加成功")
                
                if 'deleted_by' in columns:
                    print("   deleted_by 字段已存在")
                else:
                    print("   添加 deleted_by 字段...")
                    conn.execute(text("ALTER TABLE idea_card ADD COLUMN deleted_by INTEGER"))
                    print("   ✓ deleted_by 字段添加成功")
                
                conn.commit()
            
            print("\n2. 创建 OperationLog 表...")
            db.create_all()
            print("   ✓ OperationLog 表创建成功")
            
            print("\n" + "=" * 60)
            print("数据库迁移完成！")
            print("=" * 60)
            
        except Exception as e:
            print(f"\n✗ 迁移失败: {e}")
            import traceback
            traceback.print_exc()
            db.session.rollback()
            return False
    
    return True

if __name__ == '__main__':
    success = migrate_database()
    sys.exit(0 if success else 1)
