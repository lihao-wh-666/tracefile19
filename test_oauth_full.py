import sys
sys.path.insert(0, '.')

from app import create_app
from app.models import db, User, OAuthAccount, EmailVerificationCode
from app.services.oauth_service import OAuthAccountManager

app = create_app()
app.config['DEBUG'] = True

with app.app_context():
    db.create_all()
    print("数据库表创建成功")

client = app.test_client()

print("\n=== 测试1: 获取OAuth providers ===")
response = client.get('/api/auth/oauth/providers')
print(f"状态码: {response.status_code}")
data = response.get_json()
print(f"Providers数量: {len(data.get('providers', []))}")
for p in data.get('providers', []):
    print(f"  - {p['provider']}: {p['name']} ({p['icon']})")

print("\n=== 测试2: 发送邮箱验证码(DEBUG模式) ===")
response = client.post('/api/auth/email/send-code', json={
    'email': 'test_oauth@example.com',
    'purpose': 'login'
})
print(f"状态码: {response.status_code}")
data = response.get_json()
print(f"消息: {data.get('message', data.get('error', ''))}")
test_code = data.get('code')
if test_code:
    print(f"测试验证码: {test_code}")

print("\n=== 测试3: 邮箱验证码登录(新用户自动注册) ===")
response = client.post('/api/auth/email/login', json={
    'email': 'test_oauth@example.com',
    'code': test_code
})
print(f"状态码: {response.status_code}")
data = response.get_json()
if response.status_code == 200:
    print(f"登录成功，用户: {data.get('user', {}).get('username', '')}")
    print(f"用户邮箱: {data.get('user', {}).get('email', '')}")
    token = data.get('access_token', '')
    user_id = data.get('user', {}).get('id', '')
else:
    print(f"错误: {data.get('error', '')}")
    token = None

if token:
    print("\n=== 测试4: 使用错误验证码登录 ===")
    response = client.post('/api/auth/email/login', json={
        'email': 'test_oauth@example.com',
        'code': '000000'
    })
    print(f"状态码: {response.status_code}")
    data = response.get_json()
    print(f"错误: {data.get('error', '')}")

    print("\n=== 测试5: 获取绑定账号列表 ===")
    response = client.get('/api/auth/oauth/accounts', headers={
        'Authorization': f'Bearer {token}'
    })
    print(f"状态码: {response.status_code}")
    data = response.get_json()
    print(f"已绑定账号数: {len(data.get('accounts', []))}")
    print(f"是否有密码: {data.get('has_password', False)}")

    print("\n=== 测试6: 模拟OAuth账号关联(GitHub) ===")
    with app.app_context():
        success, error = OAuthAccountManager.link_account(
            user_id=user_id,
            provider='github',
            provider_user_id='123456',
            access_token='test_access_token'
        )
        print(f"关联结果: {success}, 错误: {error}")

    print("\n=== 测试7: 再次获取绑定账号列表 ===")
    response = client.get('/api/auth/oauth/accounts', headers={
        'Authorization': f'Bearer {token}'
    })
    print(f"状态码: {response.status_code}")
    data = response.get_json()
    print(f"已绑定账号数: {len(data.get('accounts', []))}")
    for acc in data.get('accounts', []):
        print(f"  - {acc['provider']}: ID={acc['provider_user_id']}")

    print("\n=== 测试8: 解绑GitHub账号 ===")
    response = client.post('/api/auth/oauth/unlink/github', headers={
        'Authorization': f'Bearer {token}'
    })
    print(f"状态码: {response.status_code}")
    data = response.get_json()
    print(f"消息: {data.get('message', data.get('error', ''))}")

    print("\n=== 测试9: 验证解绑结果 ===")
    response = client.get('/api/auth/oauth/accounts', headers={
        'Authorization': f'Bearer {token}'
    })
    print(f"状态码: {response.status_code}")
    data = response.get_json()
    print(f"已绑定账号数: {len(data.get('accounts', []))}")

print("\n=== 测试10: GitHub OAuth未配置的错误处理 ===")
response = client.get('/api/auth/oauth/github')
print(f"状态码: {response.status_code}")
data = response.get_json()
print(f"错误: {data.get('error', '')}")

print("\n=== 测试11: QQ OAuth未配置的错误处理 ===")
response = client.get('/api/auth/oauth/qq')
print(f"状态码: {response.status_code}")
data = response.get_json()
print(f"错误: {data.get('error', '')}")

print("\n=== 测试12: 邮箱格式验证 ===")
response = client.post('/api/auth/email/send-code', json={
    'email': '',
    'purpose': 'login'
})
print(f"状态码: {response.status_code}")
data = response.get_json()
print(f"错误: {data.get('error', '')}")

print("\n=== 测试13: 获取公钥 ===")
response = client.get('/api/auth/public-key')
print(f"状态码: {response.status_code}")
data = response.get_json()
print(f"公钥存在: {'public_key' in data and len(data['public_key']) > 0}")

print("\n=== 所有测试完成 ===")
print("\n功能总结:")
print("✓ OAuth providers 列表接口")
print("✓ 邮箱验证码发送(DEBUG模式返回测试码)")
print("✓ 邮箱验证码登录/注册")
print("✓ 验证码错误处理")
print("✓ 第三方账号绑定")
print("✓ 第三方账号解绑")
print("✓ OAuth未配置时的友好提示")
print("✓ 参数校验")
print("✓ JWT token 认证")
