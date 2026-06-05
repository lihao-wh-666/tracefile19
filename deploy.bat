@echo off
echo ========================================
echo GameDev Hub - Docker Deployment
echo ========================================
echo.

echo [1/3] Building Docker images...
docker-compose build

echo [2/3] Starting services...
docker-compose up -d

echo [3/3] Waiting for services to be ready...
timeout /t 10

echo.
echo ========================================
echo Deployment completed!
echo ========================================
echo.
echo Application: http://localhost
echo API Base: http://localhost/api
echo.
echo Default admin account:
echo   Email: admin@example.com
echo   Password: admin123
echo.
echo To view logs: docker-compose logs -f
echo To stop: docker-compose down
echo.
