import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'jwt-secret-key-change-in-production')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)
    
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL', 'sqlite:///gamedev_platform.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024
    
    ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', 'admin@example.com')
    ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin123')
    
    MAX_LOGIN_ATTEMPTS = int(os.environ.get('MAX_LOGIN_ATTEMPTS', 5))
    LOGIN_LOCK_WINDOW_MINUTES = int(os.environ.get('LOGIN_LOCK_WINDOW_MINUTES', 30))
    
    TIMEZONE = os.environ.get('TZ', 'Asia/Shanghai')

    GITHUB_CLIENT_ID = os.environ.get('GITHUB_CLIENT_ID', '')
    GITHUB_CLIENT_SECRET = os.environ.get('GITHUB_CLIENT_SECRET', '')
    GITHUB_REDIRECT_URI = os.environ.get('GITHUB_REDIRECT_URI', 'http://localhost:5000/api/auth/oauth/github/callback')

    QQ_APP_ID = os.environ.get('QQ_APP_ID', '')
    QQ_APP_KEY = os.environ.get('QQ_APP_KEY', '')
    QQ_REDIRECT_URI = os.environ.get('QQ_REDIRECT_URI', 'http://localhost:5000/api/auth/oauth/qq/callback')

    EMAIL_VERIFICATION_CODE_EXPIRES = int(os.environ.get('EMAIL_VERIFICATION_CODE_EXPIRES', 300))
    EMAIL_SMTP_HOST = os.environ.get('EMAIL_SMTP_HOST', '')
    EMAIL_SMTP_PORT = int(os.environ.get('EMAIL_SMTP_PORT', 587))
    EMAIL_SMTP_USER = os.environ.get('EMAIL_SMTP_USER', '')
    EMAIL_SMTP_PASSWORD = os.environ.get('EMAIL_SMTP_PASSWORD', '')
    EMAIL_SENDER = os.environ.get('EMAIL_SENDER', '')

    OAUTH_STATE_TIMEOUT = int(os.environ.get('OAUTH_STATE_TIMEOUT', 600))
