@echo off
chcp 65001 >nul
title IndexNow 全站推送工具 - 航线引航
echo ========================================================
echo       航线引航 (hangxianyinhang.com) IndexNow 自动推送
echo ========================================================
echo.
node "%~dp0scripts\push-indexnow.js"
echo.
pause
