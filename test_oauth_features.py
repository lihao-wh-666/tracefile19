import sys
sys.path.insert(0, '.')

from app import create_app
from app.models import db, User, OAuthAccount, EmailVerificationCode

app = create_app()

with app.app_context():
    db.create_all()
    print("数据库表创建成功")

client = app.test_client()

print("\n=== 测试1: 获取OAuth providers ===")
response = client.get('/api/auth/oauth/providers')
print(f"状态码: {response.status_code}")
data = response.get_json()
print(f"Providers: {data.get('providers', [])}")

print("\n=== 测试2: 发送邮箱验证码 ===")
response = client.post('/api/auth/email/send-code', json={
    'email': 'test@example.com',
    'purpose': 'login'
})
print(f"状态码: {response.status_code}")
data = response.get_json()
print(f"消息: {data.get('message', data.get('error', ''))}")
if data.get('code'):
    print(f"测试验证码: {data.get('code')}")

print("\n=== 测试3: GitHub OAuth登录URL ===")
response = client.get('/api/auth/oauth/github')
print(f"状态码: {response.status_code}")
data = response.get_json()
if response.status_code == 200:
    print(f"授权URL: {data.get('auth_url', '')[:80]}...")
else:
    print(f"错误: {data.get('error', '')}")

print("\n=== 测试4: QQ OAuth登录URL ===")
response = client.get('/api/auth/oauth/qq')
print(f"状态码: {response.status_code}")
data = response.get_json()
if response.status_code == 200:
    print(f"授权URL: {data.get('auth_url', '')[:80]}...")
else:
    print(f"错误: {data.get('error', '')}")

print("\n=== 测试5: 检查邮箱可用性 ===")
response = client.post('/api/auth/check-email', json={
    'email': 'test@example.com'
})
print(f"状态码: {response.status_code}")
data = response.get_json()
print(f"邮箱可用: {data.get('available', False)}")

print("\n=== 测试6: 邮箱验证码登录(未注册用户) ===")
with app.app_context():
    ver_code = EmailVerificationCode.query.filter_by(email='test@example.com').first()
    if ver_code:
        print(f"数据库中的验证码: {ver_code.code}")
        response = client.post('/api/auth/email/login', json={
            'email': 'test@example.com',
            'code': ver_code.code
        })
        print(f"状态码: {response.status_code}")
        data = response.get_json()
        if response.status_code == 200:
            print(f"登录成功，用户: {data.get('user', {}).get('username', '')}")
            print(f"Token: {data.get('access_token', '')[:30]}...")
            token = data.get('access_token', '')
            
            print("\n=== 测试7: 获取当前用户信息 ===")
            response = client.get('/api/auth/me', headers={
                'Authorization': f'Bearer {token}'
            })
            print(f"状态码: {response.status_code}")
            data = response.get_json()
            print(f"用户: {data.get('user', {}).get('username', '')}")
            
            print("\n=== 测试8: 获取绑定的账号列表 ===")
            response = client.get('/api/auth/oauth/accounts', headers={
                'Authorization': f'Bearer {token}'
            })
            print(f"状态码: {response.status_code}")
            data = response.get_json()
            print(f"账号列表: {data.get('accounts', [])}")
            print(f"是否有密码: {data.get('has_password', False)}")
        else:
            print(f"错误: {data.get('error', '')}")

print("\n=== 所有测试完成 ===")
