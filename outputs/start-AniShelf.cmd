@echo off
chcp 65001 >nul
setlocal
where node >nul 2>nul
if errorlevel 1 (
 echo 未找到 Node.js。请安装 Node.js 后重新打开此启动器。
 pause
 exit /b 1
)
if not exist "%~dp0launch-AniShelf.cjs" (
 echo 启动文件缺失：launch-AniShelf.cjs。请保持交付文件位于同一文件夹。
 pause
 exit /b 1
)
node "%~dp0launch-AniShelf.cjs"
if errorlevel 1 (
 echo.
 pause
 exit /b 1
)
exit /b 0
