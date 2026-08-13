# Scripts de Manutenção

## Limpar Dados

Você pode limpar todos os dados diretamente pelo app, em **Configurações > Limpar Dados** (com confirmação).

Alternativamente, para limpar os dados de fora do app, a partir do seu PC, com um dispositivo ou emulador Android conectado via `adb`:

### Windows:
```bash
# Clique duplo no arquivo ou execute:
scripts/clear-data.bat
```

### Node.js direto:
```bash
node scripts/clear-data.js
```

Este script usa `adb shell pm clear` para apagar os dados do app no dispositivo/emulador conectado — ele **não** funciona sem um dispositivo/emulador Android acessível via `adb devices`.

⚠️ **Atenção**: Isso remove TODOS os dados do app permanentemente!