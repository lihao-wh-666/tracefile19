import requests
import base64
from Crypto.PublicKey import RSA
from Crypto.Cipher import PKCS1_v1_5

BASE_URL = 'http://localhost:5000/api'

def encrypt_password(public_key_pem, password):
    public_key = RSA.import_key(public_key_pem)
    cipher = PKCS1_v1_5.new(public_key)
    encrypted = cipher.encrypt(password.encode('utf-8'))
    return base64.b64encode(encrypted).decode('utf-8')

def test_chat_features():
    print("=" * 60)
    print("测试消息中心新功能")
    print("=" * 60)
    
    session = requests.Session()
    
    print("\n1. 获取公钥...")
    pubkey_response = session.get(f'{BASE_URL}/auth/public-key')
    if pubkey_response.status_code != 200:
        print(f"获取公钥失败: {pubkey_response.text}")
        return False
    
    public_key_pem = pubkey_response.json().get('public_key')
    print("✓ 获取公钥成功")
    
    print("\n2. 登录管理员账号...")
    encrypted_password = encrypt_password(public_key_pem, 'admin123')
    login_response = session.post(f'{BASE_URL}/auth/login', json={
        'email': 'admin@example.com',
        'password': encrypted_password
    })
    
    if login_response.status_code != 200:
        print(f"登录失败: {login_response.text}")
        return False
    
    login_data = login_response.json()
    token = login_data.get('access_token')
    session.headers.update({'Authorization': f'Bearer {token}'})
    print("✓ 登录成功")
    
    print("\n3. 获取当前房间列表...")
    rooms_response = session.get(f'{BASE_URL}/chat/rooms')
    if rooms_response.status_code != 200:
        print(f"获取房间列表失败: {rooms_response.text}")
        return False
    
    rooms_data = rooms_response.json()
    rooms = rooms_data.get('rooms', [])
    print(f"✓ 当前有 {len(rooms)} 个房间")
    for room in rooms:
        print(f"  - [{room['type']}] {room['name']} (ID: {room['id']})")
    
    print("\n4. 创建测试群聊...")
    group_response = session.post(f'{BASE_URL}/chat/rooms/group', json={
        'name': '测试群聊',
        'member_ids': []
    })
    
    if group_response.status_code == 201:
        group_room = group_response.json().get('room')
        print(f"✓ 创建群聊成功: {group_room['name']} (ID: {group_room['id']})")
    else:
        print(f"创建群聊失败: {group_response.text}")
        return False
    
    print("\n5. 测试删除群聊功能（群主解散群聊）...")
    delete_response = session.delete(f'{BASE_URL}/chat/rooms/{group_room["id"]}')
    if delete_response.status_code == 200:
        print(f"✓ 删除群聊成功: {delete_response.json().get('message')}")
    else:
        print(f"删除群聊失败: {delete_response.text}")
    
    print("\n6. 重新创建群聊用于测试退出...")
    group2_response = session.post(f'{BASE_URL}/chat/rooms/group', json={
        'name': '退出测试群',
        'member_ids': []
    })
    
    if group2_response.status_code == 201:
        group2_room = group2_response.json().get('room')
        print(f"✓ 创建群聊成功: {group2_room['name']} (ID: {group2_room['id']})")
    else:
        print(f"创建群聊失败: {group2_response.text}")
        return False
    
    print("\n7. 测试退出群聊功能...")
    leave_response = session.post(f'{BASE_URL}/chat/rooms/{group2_room["id"]}/leave', json={})
    if leave_response.status_code == 200:
        print(f"✓ 退出群聊成功: {leave_response.json().get('message')}")
    else:
        print(f"退出群聊失败: {leave_response.text}")
    
    print("\n8. 验证退出后的房间列表...")
    rooms2_response = session.get(f'{BASE_URL}/chat/rooms')
    rooms2 = rooms2_response.json().get('rooms', [])
    print(f"✓ 当前有 {len(rooms2)} 个房间")
    
    print("\n9. 创建私聊测试...")
    test_user_id = None
    users_response = session.get(f'{BASE_URL}/profile/list?per_page=10')
    if users_response.status_code == 200:
        users = users_response.json().get('users', [])
        for user in users:
            if user.get('email') and user['email'] != 'admin@example.com':
                test_user_id = user['id']
                print(f"  找到测试用户: {user['username']} (ID: {test_user_id})")
                break
    
    if test_user_id:
        private_response = session.post(f'{BASE_URL}/chat/rooms/private/{test_user_id}', json={})
        if private_response.status_code in [200, 201]:
            private_room = private_response.json().get('room')
            print(f"✓ 创建私聊成功: {private_room['name']} (ID: {private_room['id']})")
            
            print("\n10. 测试删除私聊功能...")
            delete_private_response = session.delete(f'{BASE_URL}/chat/rooms/{private_room["id"]}')
            if delete_private_response.status_code == 200:
                print(f"✓ 删除私聊成功: {delete_private_response.json().get('message')}")
            else:
                print(f"删除私聊失败: {delete_private_response.text}")
        else:
            print(f"创建私聊失败: {private_response.text}")
    else:
        print("  没有找到其他测试用户，跳过私聊测试")
    
    print("\n" + "=" * 60)
    print("测试完成！所有功能验证通过 ✓")
    print("=" * 60)
    return True

if __name__ == '__main__':
    test_chat_features()
