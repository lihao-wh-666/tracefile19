import requests
import random
import string
import smtplib
from email.mime.text import MIMEText
from email.header import Header
from datetime import datetime, timedelta
from flask import current_app
from app.models import db, User, OAuthAccount, EmailVerificationCode, UserNotificationSettings, ChatRoom, ChatRoomMember


def generate_state():
    return ''.join(random.choices(string.ascii_letters + string.digits, k=32))


def generate_verification_code():
    return ''.join(random.choices(string.digits, k=6))


def generate_random_username(base_name=''):
    suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    if base_name:
        base = base_name[:10]
        return f"{base}_{suffix}"
    return f"user_{suffix}"


class GitHubOAuth:
    AUTH_URL = 'https://github.com/login/oauth/authorize'
    TOKEN_URL = 'https://github.com/login/oauth/access_token'
    USER_URL = 'https://api.github.com/user'
    EMAILS_URL = 'https://api.github.com/user/emails'

    @classmethod
    def get_authorization_url(cls, state):
        client_id = current_app.config.get('GITHUB_CLIENT_ID')
        redirect_uri = current_app.config.get('GITHUB_REDIRECT_URI')
        params = {
            'client_id': client_id,
            'redirect_uri': redirect_uri,
            'state': state,
            'scope': 'read:user user:email',
        }
        from urllib.parse import urlencode
        return f"{cls.AUTH_URL}?{urlencode(params)}"

    @classmethod
    def get_access_token(cls, code):
        client_id = current_app.config.get('GITHUB_CLIENT_ID')
        client_secret = current_app.config.get('GITHUB_CLIENT_SECRET')
        redirect_uri = current_app.config.get('GITHUB_REDIRECT_URI')

        try:
            response = requests.post(cls.TOKEN_URL, data={
                'client_id': client_id,
                'client_secret': client_secret,
                'code': code,
                'redirect_uri': redirect_uri,
            }, headers={'Accept': 'application/json'})
            data = response.json()
            return data.get('access_token')
        except Exception as e:
            current_app.logger.error(f"GitHub get access token error: {e}")
            return None

    @classmethod
    def get_user_info(cls, access_token):
        try:
            headers = {'Authorization': f'token {access_token}', 'Accept': 'application/json'}
            response = requests.get(cls.USER_URL, headers=headers)
            user_data = response.json()

            email = user_data.get('email')
            if not email:
                email_response = requests.get(cls.EMAILS_URL, headers=headers)
                emails = email_response.json()
                primary_email = next((e for e in emails if e.get('primary')), None)
                email = primary_email.get('email') if primary_email else None

            return {
                'id': str(user_data.get('id')),
                'username': user_data.get('login'),
                'email': email,
                'avatar': user_data.get('avatar_url'),
                'bio': user_data.get('bio', ''),
                'name': user_data.get('name', ''),
            }
        except Exception as e:
            current_app.logger.error(f"GitHub get user info error: {e}")
            return None


class QQOAuth:
    AUTH_URL = 'https://graph.qq.com/oauth2.0/authorize'
    TOKEN_URL = 'https://graph.qq.com/oauth2.0/token'
    OPEN_ID_URL = 'https://graph.qq.com/oauth2.0/me'
    USER_INFO_URL = 'https://graph.qq.com/user/get_user_info'

    @classmethod
    def get_authorization_url(cls, state):
        app_id = current_app.config.get('QQ_APP_ID')
        redirect_uri = current_app.config.get('QQ_REDIRECT_URI')
        params = {
            'client_id': app_id,
            'redirect_uri': redirect_uri,
            'response_type': 'code',
            'state': state,
            'scope': 'get_user_info',
        }
        from urllib.parse import urlencode
        return f"{cls.AUTH_URL}?{urlencode(params)}"

    @classmethod
    def get_access_token(cls, code):
        app_id = current_app.config.get('QQ_APP_ID')
        app_key = current_app.config.get('QQ_APP_KEY')
        redirect_uri = current_app.config.get('QQ_REDIRECT_URI')

        try:
            response = requests.get(cls.TOKEN_URL, params={
                'grant_type': 'authorization_code',
                'client_id': app_id,
                'client_secret': app_key,
                'code': code,
                'redirect_uri': redirect_uri,
                'fmt': 'json',
            })
            data = response.json()
            return data.get('access_token')
        except Exception as e:
            current_app.logger.error(f"QQ get access token error: {e}")
            return None

    @classmethod
    def get_open_id(cls, access_token):
        try:
            response = requests.get(cls.OPEN_ID_URL, params={
                'access_token': access_token,
                'fmt': 'json',
            })
            data = response.json()
            return data.get('openid')
        except Exception as e:
            current_app.logger.error(f"QQ get open id error: {e}")
            return None

    @classmethod
    def get_user_info(cls, access_token, open_id):
        app_id = current_app.config.get('QQ_APP_ID')
        try:
            response = requests.get(cls.USER_INFO_URL, params={
                'access_token': access_token,
                'oauth_consumer_key': app_id,
                'openid': open_id,
            })
            data = response.json()
            return {
                'id': open_id,
                'username': data.get('nickname', ''),
                'avatar': data.get('figureurl_qq_2') or data.get('figureurl_qq_1', ''),
                'gender': data.get('gender', ''),
            }
        except Exception as e:
            current_app.logger.error(f"QQ get user info error: {e}")
            return None


class EmailService:
    @classmethod
    def send_verification_email(cls, email, code, purpose='login'):
        smtp_host = current_app.config.get('EMAIL_SMTP_HOST')
        smtp_port = current_app.config.get('EMAIL_SMTP_PORT')
        smtp_user = current_app.config.get('EMAIL_SMTP_USER')
        smtp_password = current_app.config.get('EMAIL_SMTP_PASSWORD')
        sender = current_app.config.get('EMAIL_SENDER')

        if not all([smtp_host, smtp_user, smtp_password]):
            current_app.logger.warning("Email SMTP not configured")
            return False

        try:
            purpose_text = '登录' if purpose == 'login' else '注册'
            subject = f'您的{purpose_text}验证码 - GameDev Hub'
            body = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #6366f1;">欢迎使用 GameDev Hub</h2>
                <p>您的验证码是：</p>
                <div style="font-size: 32px; font-weight: bold; color: #6366f1; 
                            padding: 20px; background: #f0f0ff; border-radius: 8px; 
                            text-align: center; letter-spacing: 8px;">
                    {code}
                </div>
                <p style="margin-top: 20px;">该验证码将在 <strong>5分钟</strong> 内有效，请勿泄露给他人。</p>
                <p>如果这不是您的操作，请忽略此邮件。</p>
                <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;">
                <p style="color: #999; font-size: 12px;">这是一封自动发送的邮件，请不要直接回复。</p>
            </div>
            """

            msg = MIMEText(body, 'html', 'utf-8')
            msg['Subject'] = Header(subject, 'utf-8')
            msg['From'] = sender
            msg['To'] = email

            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.starttls()
                server.login(smtp_user, smtp_password)
                server.sendmail(sender, [email], msg.as_string())

            return True
        except Exception as e:
            current_app.logger.error(f"Send email error: {e}")
            return False

    @classmethod
    def create_verification_code(cls, email, purpose='login'):
        expires_seconds = current_app.config.get('EMAIL_VERIFICATION_CODE_EXPIRES', 300)
        code = generate_verification_code()
        expires_at = datetime.utcnow() + timedelta(seconds=expires_seconds)

        EmailVerificationCode.query.filter_by(
            email=email, purpose=purpose, used=False
        ).update({'used': True})

        verification = EmailVerificationCode(
            email=email,
            code=code,
            purpose=purpose,
            expires_at=expires_at,
        )
        db.session.add(verification)
        db.session.commit()

        return code

    @classmethod
    def verify_code(cls, email, code, purpose='login'):
        verification = EmailVerificationCode.query.filter_by(
            email=email, code=code, purpose=purpose
        ).order_by(EmailVerificationCode.created_at.desc()).first()

        if not verification or not verification.is_valid():
            return False

        verification.used = True
        verification.used_at = datetime.utcnow()
        db.session.commit()

        return True


class OAuthAccountManager:
    @staticmethod
    def get_or_create_user(provider, provider_user_id, user_info, email=None):
        oauth_account = OAuthAccount.query.filter_by(
            provider=provider,
            provider_user_id=provider_user_id
        ).first()

        if oauth_account:
            user = oauth_account.user
            if not user.is_active:
                return None, '账号已被禁用'
            return user, None

        user_email = email or user_info.get('email')

        if user_email:
            user = User.query.filter_by(email=user_email).first()
            if user:
                OAuthAccountManager.link_account(
                    user.id, provider, provider_user_id,
                    user_info.get('access_token'),
                    user_info.get('refresh_token')
                )
                return user, None

        username = user_info.get('username') or generate_random_username()
        original_username = username
        counter = 1
        while User.query.filter_by(username=username).first():
            username = f"{original_username}_{counter}"
            counter += 1

        if not user_email:
            user_email = f"{provider}_{provider_user_id}@oauth.local"

        user = User(
            username=username,
            email=user_email,
            avatar=user_info.get('avatar', ''),
            bio=user_info.get('bio', ''),
            role='user',
            is_active=True
        )
        user.set_password(generate_random_username())
        db.session.add(user)
        db.session.flush()

        oauth_account = OAuthAccount(
            user_id=user.id,
            provider=provider,
            provider_user_id=provider_user_id,
            access_token=user_info.get('access_token'),
            refresh_token=user_info.get('refresh_token'),
        )
        db.session.add(oauth_account)

        notify_settings = UserNotificationSettings(user_id=user.id)
        db.session.add(notify_settings)

        default_room = ChatRoom.query.filter_by(name='开发者广场', type='group').first()
        if default_room:
            member = ChatRoomMember(room_id=default_room.id, user_id=user.id)
            db.session.add(member)

        db.session.commit()

        return user, None

    @staticmethod
    def link_account(user_id, provider, provider_user_id, access_token=None, refresh_token=None):
        existing = OAuthAccount.query.filter_by(
            provider=provider, provider_user_id=provider_user_id
        ).first()

        if existing and existing.user_id != user_id:
            return False, '该账号已被其他用户绑定'

        if existing:
            if access_token:
                existing.access_token = access_token
            if refresh_token:
                existing.refresh_token = refresh_token
            db.session.commit()
            return True, None

        oauth_account = OAuthAccount(
            user_id=user_id,
            provider=provider,
            provider_user_id=provider_user_id,
            access_token=access_token,
            refresh_token=refresh_token,
        )
        db.session.add(oauth_account)
        db.session.commit()

        return True, None

    @staticmethod
    def unlink_account(user_id, provider):
        oauth_account = OAuthAccount.query.filter_by(
            user_id=user_id, provider=provider
        ).first()

        if not oauth_account:
            return False, '未找到绑定记录'

        user = User.query.get(user_id)
        if user and len(user.oauth_accounts) <= 1 and not user.password_hash:
            return False, '至少需要保留一种登录方式'

        db.session.delete(oauth_account)
        db.session.commit()

        return True, None

    @staticmethod
    def get_user_oauth_accounts(user_id):
        accounts = OAuthAccount.query.filter_by(user_id=user_id).all()
        return [acc.to_dict() for acc in accounts]
