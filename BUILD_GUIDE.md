# Guia de Build APK - MoneyGen

Este guia explica como gerar APKs do aplicativo MoneyGen usando EAS Build.

## Pré-requisitos

1. **Conta Expo**: Crie uma conta em [expo.dev](https://expo.dev)
2. **EAS CLI**: Instale globalmente
   ```bash
   npm install -g @expo/eas-cli
   ```
3. **Login**: Faça login na sua conta Expo
   ```bash
   eas login
   ```

## Métodos de Build

### 1. Build Rápido (Recomendado)

Execute o script automatizado:
```bash
# Windows
scripts\build-apk.bat

# Ou manualmente
npm run build:preview
```

### 2. Builds Específicos

#### APK Debug (Mais rápido)
```bash
npm run build:apk-debug
# ou
eas build --platform android --profile apk-debug
```

#### APK Release (Otimizado)
```bash
npm run build:apk-release
# ou
eas build --platform android --profile apk-release
```

#### Preview (Padrão)
```bash
npm run build:preview
# ou
eas build --platform android --profile preview
```

#### Production (Google Play Store)
```bash
npm run build:production
# ou
eas build --platform android --profile production
```

### 3. Build Local (Requer Android Studio)

```bash
npm run build:local
# ou
eas build --platform android --profile preview --local
```

## Perfis de Build

| Perfil | Tipo | Uso | Tempo |
|--------|------|-----|-------|
| `apk-debug` | APK | Testes rápidos | ~5-10 min |
| `apk-release` | APK | Distribuição | ~10-15 min |
| `preview` | APK | Preview/Testes | ~10-15 min |
| `production` | AAB | Google Play | ~15-20 min |

## Processo Passo a Passo

### Primeira vez:

1. **Configure o projeto**:
   ```bash
   eas build:configure
   ```

2. **Inicie o build**:
   ```bash
   npm run build:preview
   ```

3. **Aguarde**: O build será processado na nuvem da Expo

4. **Download**: O APK será baixado automaticamente quando pronto

### Builds subsequentes:

```bash
npm run build:preview
```

## Configurações do Build

As configurações estão em `eas.json`:

- **apk-debug**: Build rápido para testes
- **apk-release**: Build otimizado para distribuição
- **preview**: Build padrão com APK
- **production**: Build para Google Play Store (AAB)

## Troubleshooting

### Erro de autenticação:
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

### Build local não funciona:
- Instale Android Studio
- Configure Android SDK
- Configure variáveis de ambiente ANDROID_HOME

## URLs Úteis

- **Expo Dashboard**: https://expo.dev/accounts/[seu-usuario]/projects/moneygen
- **Builds**: https://expo.dev/accounts/[seu-usuario]/projects/moneygen/builds
- **Documentação EAS**: https://docs.expo.dev/build/introduction/

## Comandos Úteis

```bash
# Ver status dos builds
eas build:list

# Cancelar build
eas build:cancel [build-id]

# Ver logs detalhados
eas build:view [build-id]

# Configurar credenciais
eas credentials
```

## Distribuição

### APK (Instalação direta):
1. Baixe o APK do dashboard Expo
2. Envie para o dispositivo Android
3. Ative "Fontes desconhecidas" nas configurações
4. Instale o APK

### Google Play Store (AAB):
1. Use o perfil `production`
2. Baixe o arquivo AAB
3. Faça upload no Google Play Console

## Automatização

Para builds automáticos, você pode usar GitHub Actions ou outros CI/CD com:

```yaml
- name: Build APK
  run: |
    npm install -g @expo/eas-cli
    eas build --platform android --profile preview --non-interactive
```