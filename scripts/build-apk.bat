@echo off
echo ========================================
echo     MoneyGen - Build APK Script
echo ========================================
echo.

echo Verificando se EAS CLI esta instalado...
call npx eas --version >nul 2>&1
if %errorlevel% neq 0 (
    echo EAS CLI nao encontrado. Instalando...
    call npm install -g @expo/eas-cli
)

echo.
echo Escolha o tipo de build:
echo 1. APK Debug (rapido, para testes)
echo 2. APK Release (otimizado, para distribuicao)
echo 3. Preview (APK com configuracoes de preview)
echo 4. Production (AAB para Google Play Store)
echo 5. Build Local (requer Android Studio)
echo.

set /p choice="Digite sua opcao (1-5): "

if "%choice%"=="1" (
    echo Iniciando build APK Debug...
    call npm run build:apk-debug
) else if "%choice%"=="2" (
    echo Iniciando build APK Release...
    call npm run build:apk-release
) else if "%choice%"=="3" (
    echo Iniciando build Preview...
    call npm run build:preview
) else if "%choice%"=="4" (
    echo Iniciando build Production...
    call npm run build:production
) else if "%choice%"=="5" (
    echo Iniciando build local...
    call npm run build:local
) else (
    echo Opcao invalida!
    pause
    exit /b 1
)

echo.
echo Build concluido! Verifique o resultado no terminal acima.
echo O APK sera baixado automaticamente quando pronto.
pause