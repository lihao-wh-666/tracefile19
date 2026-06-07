import requests
import json
from Crypto.PublicKey import RSA
from Crypto.Cipher import PKCS1_v1_5
import base64

BASE_URL = 'http://127.0.0.1:5000'

def encrypt_password(public_key_pem, password):
    public_key = RSA.import_key(public_key_pem)
    cipher = PKCS1_v1_5.new(public_key)
    encrypted = cipher.encrypt(password.encode('utf-8'))
    return base64.b64encode(encrypted).decode('utf-8')

resp = requests.get(f'{BASE_URL}/api/auth/public-key')
public_key_pem = resp.json()['public_key']

login_data = {
    'email': 'admin@example.com',
    'password': encrypt_password(public_key_pem, 'admin123')
}
resp = requests.post(f'{BASE_URL}/api/auth/login', json=login_data)
print('Login status:', resp.status_code)
if resp.status_code == 200:
    token = resp.json()['access_token']
    headers = {'Authorization': f'Bearer {token}'}
    print('Login successful')
    
    resp = requests.get(f'{BASE_URL}/api/projects', headers=headers)
    print('\nGet projects status:', resp.status_code)
    print('Projects:', json.dumps(resp.json(), indent=2, ensure_ascii=False))
    
    project_data = {
        'name': '测试项目',
        'description': '这是一个测试项目',
        'member_ids': []
    }
    resp = requests.post(f'{BASE_URL}/api/projects', json=project_data, headers=headers)
    print('\nCreate project status:', resp.status_code)
    print('Create project response:', json.dumps(resp.json(), indent=2, ensure_ascii=False))
    
    if resp.status_code == 201:
        project_id = resp.json()['project']['id']
        
        resp = requests.get(f'{BASE_URL}/api/projects/{project_id}', headers=headers)
        print('\nGet project detail status:', resp.status_code)
        result = resp.json()
        channels = result.get('project', {}).get('channels', [])
        print('Project channels count:', len(channels))
        for ch in channels:
            print(f'  - {ch.get("channel_name")} ({ch.get("channel_type")}) - room_id: {ch.get("id")}')
        
        resp = requests.get(f'{BASE_URL}/api/projects/{project_id}/channels', headers=headers)
        print('\nGet project channels status:', resp.status_code)
        print('Channels:', json.dumps(resp.json(), indent=2, ensure_ascii=False))
        
        if channels:
            room_id = channels[0]['id']
            msg_data = {'content': 'Hello from 策划闲聊频道!', 'message_type': 'text'}
            resp = requests.post(f'{BASE_URL}/api/chat/rooms/{room_id}/messages', json=msg_data, headers=headers)
            print('\nSend message status:', resp.status_code)
            print('Message response:', json.dumps(resp.json(), indent=2, ensure_ascii=False))
            
            resp = requests.get(f'{BASE_URL}/api/chat/rooms/{room_id}/messages', headers=headers)
            print('\nGet messages status:', resp.status_code)
            print('Messages:', json.dumps(resp.json(), indent=2, ensure_ascii=False))
else:
    print('Login failed:', resp.json())
