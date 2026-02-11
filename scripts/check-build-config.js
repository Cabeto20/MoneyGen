const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando configuração de build do MoneyGen...');
console.log('='.repeat(50));

// Verificar arquivos necessários
const requiredFiles = [
  'eas.json',
  'app.json',
  'package.json',
  'App.js'
];

console.log('\n📁 Verificando arquivos necessários:');
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - FALTANDO!`);
  }
});

// Verificar EAS CLI
console.log('\n🛠️  Verificando EAS CLI:');
try {
  const easVersion = execSync('npx eas --version', { encoding: 'utf8' }).trim();
  console.log(`✅ EAS CLI instalado: ${easVersion}`);
} catch (error) {
  console.log('❌ EAS CLI não encontrado. Instale com: npm install -g @expo/eas-cli');
}

// Verificar configuração do app.json
console.log('\n📱 Verificando configuração do app:');
try {
  const appConfig = JSON.parse(fs.readFileSync('app.json', 'utf8'));
  const expo = appConfig.expo;
  
  console.log(`✅ Nome: ${expo.name}`);
  console.log(`✅ Slug: ${expo.slug}`);
  console.log(`✅ Versão: ${expo.version}`);
  
  if (expo.android && expo.android.package) {
    console.log(`✅ Package Android: ${expo.android.package}`);
  } else {
    console.log('⚠️  Package Android não configurado');
  }
  
  if (expo.extra && expo.extra.eas && expo.extra.eas.projectId) {
    console.log(`✅ Project ID: ${expo.extra.eas.projectId}`);
  } else {
    console.log('⚠️  Project ID não configurado (será criado no primeiro build)');
  }
} catch (error) {
  console.log('❌ Erro ao ler app.json:', error.message);
}

// Verificar configuração do eas.json
console.log('\n🏗️  Verificando perfis de build:');
try {
  const easConfig = JSON.parse(fs.readFileSync('eas.json', 'utf8'));
  const profiles = Object.keys(easConfig.build || {});
  
  profiles.forEach(profile => {
    const config = easConfig.build[profile];
    const buildType = config.android?.buildType || 'aab';
    console.log(`✅ ${profile}: ${buildType.toUpperCase()}`);
  });
} catch (error) {
  console.log('❌ Erro ao ler eas.json:', error.message);
}

// Verificar dependências críticas
console.log('\n📦 Verificando dependências críticas:');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  const criticalDeps = [
    'expo',
    '@react-navigation/native',
    '@react-navigation/bottom-tabs',
    'react-native'
  ];
  
  criticalDeps.forEach(dep => {
    if (deps[dep]) {
      console.log(`✅ ${dep}: ${deps[dep]}`);
    } else {
      console.log(`❌ ${dep}: FALTANDO!`);
    }
  });
} catch (error) {
  console.log('❌ Erro ao ler package.json:', error.message);
}

// Comandos disponíveis
console.log('\n🚀 Comandos de build disponíveis:');
console.log('npm run build:apk-debug    - APK Debug (rápido)');
console.log('npm run build:apk-release  - APK Release (otimizado)');
console.log('npm run build:preview      - APK Preview (recomendado)');
console.log('npm run build:production   - AAB Production (Google Play)');
console.log('npm run build:local        - Build local (requer Android Studio)');

console.log('\n📋 Próximos passos:');
console.log('1. eas login (se ainda não fez)');
console.log('2. npm run build:preview (para gerar APK)');
console.log('3. Aguarde o build na nuvem (~10-15 min)');
console.log('4. Download automático do APK quando pronto');

console.log('\n✨ Configuração verificada! Pronto para build.');