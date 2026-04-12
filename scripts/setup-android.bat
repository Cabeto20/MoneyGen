@echo off
echo Configurando Android SDK no PATH...

set ANDROID_HOME=C:\Users\%USERNAME%\AppData\Local\Android\Sdk
set PATH=%PATH%;%ANDROID_HOME%\emulator;%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\tools;%ANDROID_HOME%\tools\bin

echo Android SDK configurado!
echo.
echo Testando emulator...
emulator -list-avds

echo.
echo Se aparecerem AVDs acima, a configuracao esta correta.
echo Agora execute: npm start
pause