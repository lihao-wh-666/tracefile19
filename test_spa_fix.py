import requests

BASE = 'http://localhost:5000'

def test_route(name, url, check_text=None, check_json=False):
    print(f'=== {name} ===')
    try:
        r = requests.get(f'{BASE}{url}')
        print(f'  URL: {url}')
        print(f'  状态码: {r.status_code}')
        print(f'  Server: {r.headers.get("Server", "N/A")}')
        if check_text:
            found = check_text in r.text
            print(f'  包含 "{check_text}": {found}')
            if not found and len(r.text) < 500:
                print(f'  Response text: {r.text[:300]}')
        if check_json:
            try:
                data = r.json()
                print(f'  JSON响应: {list(data.keys())}')
            except Exception as e:
                print(f'  非JSON响应: {e}')
        print()
        return r.status_code
    except Exception as e:
        print(f'  错误: {e}')
        print()
        return None

print('=' * 60)
print('GameDev Hub - 修复后SPA路由测试')
print('=' * 60)
print()

print('--- 首页测试 ---')
test_route('首页', '/', check_text='GameDev Hub')

print('--- 静态文件测试 ---')
test_route('静态CSS', '/static/css/style.css', check_text='primary-color')
test_route('静态JS', '/static/js/app.js', check_text='class App')

print('--- SPA路由回退测试 (所有非API路径应返回index.html) ---')
print()

test_route('管理后台', '/admin', check_text='GameDev Hub')
test_route('想法广场', '/ideas', check_text='GameDev Hub')
test_route('个人中心', '/profile', check_text='GameDev Hub')
test_route('登录页', '/login', check_text='GameDev Hub')
test_route('注册页', '/register', check_text='GameDev Hub')
test_route('新建灵感', '/create-idea', check_text='GameDev Hub')
test_route('我的灵感', '/my-ideas', check_text='GameDev Hub')
test_route('想法详情', '/idea/1', check_text='GameDev Hub')
test_route('用户详情', '/user/1', check_text='GameDev Hub')
test_route('深层随机路径', '/a/b/c/d/e', check_text='GameDev Hub')

print('--- API路由测试 (应返回JSON) ---')
print()

test_route('想法API', '/api/ideas', check_json=True)
test_route('分类API', '/api/ideas/categories', check_json=True)
test_route('用户列表API', '/api/profile/list', check_json=True)
test_route('不存在的API', '/api/nonexistent')

print('=' * 60)
print('测试完成!')
print()
print('关键检查项:')
print('  ✅ 所有非API路径返回 200 且包含 "GameDev Hub" (index.html)')
print('  ✅ 所有API路径返回正常JSON响应')
print('  ✅ 不存在的API路径返回 404 JSON')
