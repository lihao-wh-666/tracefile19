@echo off
echo ========================================
echo GameDev Hub - 游戏开发者协作平台
echo ========================================
echo.

echo [1/3] Creating virtual environment...
if not exist "venv" (
    python -m venv venv
)

echo [2/3] Activating virtual environment and installing dependencies...
call venv\Scripts\activate
pip install -r requirements.txt

echo [3/3] Starting application...
echo.
echo Server is running at http://localhost:5000
echo Default admin account: admin@example.com / admin123
echo Press Ctrl+C to stop
echo.

python run.py
