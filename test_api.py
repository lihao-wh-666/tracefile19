import requests
import json
import sys

BASE_URL = 'http://localhost:5000/api'

def test_endpoint(name, method, endpoint, json_data=None, headers=None, expected_status=200):
    print(f'=== {name} ===')
    try:
        if method == 'GET':
            r = requests.get(f'{BASE_URL}{endpoint}', headers=headers)
        elif method == 'POST':
            r = requests.post(f'{BASE_URL}{endpoint}', json=json_data, headers=headers)
        elif method == 'PUT':
            r = requests.put(f'{BASE_URL}{endpoint}', json=json_data, headers=headers)
        elif method == 'DELETE':
            r = requests.delete(f'{BASE_URL}{endpoint}', headers=headers)
        
        print(f'状态码: {r.status_code}')
        result = r.json()
        print(f'响应: {json.dumps(result, indent=2, ensure_ascii=False)[:500]}')
        print()
        
        if r.status_code != expected_status:
            print(f'警告: 期望状态码 {expected_status}，实际 {r.status_code}')
        
        return result, r.status_code
    except Exception as e:
        print(f'错误: {e}')
        print()
        return None, None

def main():
    print('开始测试 GameDev Hub API')
    print('=' * 50)
    print()
    
    try:
        r = requests.get(f'{BASE_URL}/ideas')
        if r.status_code != 200:
            print('服务器未响应，请确保服务已启动')
            sys.exit(1)
    except:
        print('无法连接到服务器，请确保服务已启动')
        sys.exit(1)
    
    register_data = {
        'username': 'testuser',
        'email': 'test@example.com',
        'password': 'password123'
    }
    result, status = test_endpoint('测试用户注册', 'POST', '/auth/register', register_data, expected_status=201)
    
    if status != 201:
        register_data['username'] = 'testuser2'
        register_data['email'] = 'test2@example.com'
        result, status = test_endpoint('测试用户注册(新账号)', 'POST', '/auth/register', register_data, expected_status=201)
    
    token = result.get('access_token') if result else None
    
    login_data = {'email': register_data['email'], 'password': 'password123'}
    result, _ = test_endpoint('测试用户登录', 'POST', '/auth/login', login_data)
    token = result.get('access_token') if result else token
    
    headers = {'Authorization': f'Bearer {token}'} if token else {}
    
    test_endpoint('测试获取当前用户', 'GET', '/auth/me', headers=headers)
    
    admin_login = {'email': 'admin@example.com', 'password': 'admin123'}
    result, _ = test_endpoint('测试管理员登录', 'POST', '/auth/login', admin_login)
    admin_token = result.get('access_token') if result else None
    admin_headers = {'Authorization': f'Bearer {admin_token}'} if admin_token else {}
    
    idea_data = {
        'title': '测试游戏灵感',
        'content': '这是一个关于太空探索的游戏想法，玩家需要驾驶飞船探索未知星系...',
        'category': 'gameplay',
        'tags': '太空, 探索, 科幻',
        'status': 'published',
        'is_public': True
    }
    result, _ = test_endpoint('测试创建想法卡片', 'POST', '/ideas', idea_data, headers=headers, expected_status=201)
    idea_id = result.get('idea', {}).get('id') if result else None
    
    test_endpoint('测试获取想法列表', 'GET', '/ideas')
    
    if idea_id:
        test_endpoint('测试获取想法详情', 'GET', f'/ideas/{idea_id}')
        
        test_endpoint('测试点赞功能', 'POST', f'/ideas/{idea_id}/like', headers=headers)
        
        comment_data = {'content': '这个想法很棒！期待更多细节。'}
        test_endpoint('测试评论功能', 'POST', f'/ideas/{idea_id}/comments', comment_data, headers=headers, expected_status=201)
        
        test_endpoint('测试获取评论', 'GET', f'/ideas/{idea_id}/comments')
    
    test_endpoint('测试获取分类', 'GET', '/ideas/categories')
    
    test_endpoint('测试获取开发者列表', 'GET', '/profile/list')
    
    test_endpoint('测试管理后台 - 获取统计', 'GET', '/admin/stats', headers=admin_headers)
    
    test_endpoint('测试管理后台 - 用户列表', 'GET', '/admin/users', headers=admin_headers)
    
    test_endpoint('测试管理后台 - 想法列表', 'GET', '/admin/ideas', headers=admin_headers)
    
    profile_data = {
        'bio': '我是一名热爱游戏开发的程序员',
        'skills': 'Python, Unity, 游戏设计'
    }
    test_endpoint('测试更新个人资料', 'PUT', '/profile', profile_data, headers=headers)
    
    test_endpoint('测试获取个人资料', 'GET', '/profile', headers=headers)
    
    print('=' * 50)
    print('所有测试完成！')
    print()
    print('前端页面地址: http://localhost:5000')
    print('API 基础地址: http://localhost:5000/api')
    print()
    print('默认管理员账号:')
    print('  邮箱: admin@example.com')
    print('  密码: admin123')

if __name__ == '__main__':
    main()
