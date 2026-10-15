@echo off
chcp 65001 >nul
setlocal
where node >nul 2>nul
if errorlevel 1 (
 echo 未找到 Node.js。
 pause
 exit /b 1
)
node "%~dp0restart-AniShelf.cjs"
if errorlevel 1 pause
