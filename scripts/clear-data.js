const { execSync } = require('child_process');

const PACKAGE_NAME = 'com.moneygen.app';

function clearAllData() {
  console.log('🗑️  Limpando dados do MoneyGen no dispositivo/emulador conectado...');

  try {
    execSync('adb devices', { stdio: 'pipe' });
  } catch (error) {
    console.error('❌ ADB não encontrado. Instale o Android SDK Platform Tools e garanta que "adb" está no PATH.');
    process.exit(1);
  }

  try {
    execSync(`adb shell pm clear ${PACKAGE_NAME}`, { stdio: 'inherit' });
    console.log('🎉 Dados do app apagados com sucesso!');
  } catch (error) {
    console.error('❌ Falha ao limpar dados. Verifique se há um dispositivo/emulador conectado (adb devices) e se o app está instalado.');
    process.exit(1);
  }
}

clearAllData();
