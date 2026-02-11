# 🚀 Como Gerar APK do MoneyGen

## Método Rápido (3 passos)

### 1. Instalar EAS CLI (apenas uma vez)
```bash
npm install -g @expo/eas-cli
```

### 2. Fazer login na Expo (apenas uma vez)
```bash
eas login
```

### 3. Gerar APK
```bash
npm run build:preview
```

## Opções de Build

| Comando | Tipo | Tempo | Uso |
|---------|------|-------|-----|
| `npm run build:apk-debug` | APK Debug | ~5-10 min | Testes rápidos |
| `npm run build:preview` | APK Preview | ~10-15 min | **Recomendado** |
| `npm run build:apk-release` | APK Release | ~10-15 min | Distribuição |
| `npm run build:production` | AAB | ~15-20 min | Google Play Store |

## Script Automático (Windows)

Execute o script interativo:
```bash
scripts\build-apk.bat
```

## Verificar Configuração

Antes de fazer o build, verifique se está tudo OK:
```bash
npm run check-build
```

## Processo Completo

1. **Primeira vez**:
   ```bash
   npm install -g @expo/eas-cli
   eas login
   npm run build:preview
   ```

2. **Builds seguintes**:
   ```bash
   npm run build:preview
   ```

3. **Aguardar**: O build será processado na nuvem (~10-15 min)

4. **Download**: O APK será baixado automaticamente quando pronto

## URLs Importantes

- **Dashboard Expo**: https://expo.dev/accounts/[seu-usuario]/projects/moneygen
- **Builds**: https://expo.dev/accounts/[seu-usuario]/projects/moneygen/builds

## Troubleshooting

### Erro de login:
```bash
eas login
```

### Erro de configuração:
```bash
eas build:configure
```

### Limpar cache:
```bash
eas build --clear-cache --platform android --profile preview
```

---

**✨ Pronto! Seu projeto está configurado para gerar APKs facilmente.**