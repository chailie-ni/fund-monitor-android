@echo off
chcp 65001 >nul
echo ================================
echo  基金监控 - Android APK 构建脚本
echo ================================
echo.

:: 检测 Java
java -version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] 未检测到 Java JDK！
    echo 请先安装 JDK 17: https://adoptium.net/temurin/releases/
    echo.
    pause
    exit /b 1
)

echo [OK] Java 检测通过
echo.

:: 构建 APK
echo [1/2] 同步 Web 资源...
call npx cap sync android

echo [2/2] 构建 APK...
cd android
call gradlew.bat assembleDebug

if %errorlevel% equ 0 (
    echo.
    echo ===== 构建成功！=====
    echo APK 位置: android\app\build\outputs\apk\debug\
    echo.
) else (
    echo.
    echo [ERROR] 构建失败，请检查错误信息
    echo.
)

<<<<<<< HEAD
pause
=======
pause
>>>>>>> 35976c2 (﻿fix: BOM清理 + 网络安全配置 + 乱码修复)
