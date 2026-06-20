@echo off
set "NODE_HOME=C:\Users\Diego Barbosa\AppData\Local\node-portable\node-v20.19.3-win-x64"
set "PATH=%NODE_HOME%;%PATH%"
cd /d "C:\Users\Diego Barbosa\Desktop\Projeto\projeto-completo"
"%NODE_HOME%\npm.cmd" run dev
