#!/usr/bin/env node
/**
 * PreToolUse hook: dispara antes de comandos Bash/PowerShell. Se o comando for
 * um build Android real (gradlew ...assemble... ou eas build), incrementa a
 * versão patch (semver) e o versionCode antes de a build rodar, para que o
 * artefato gerado já saia com a versão nova embutida.
 *
 * Qualquer outro comando Bash/PowerShell passa direto (exit 0, sem tocar em nada).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const PACKAGE_JSON = path.join(ROOT, 'package.json');
const APP_JSON = path.join(ROOT, 'app.json');

const isBuildCommand = (command) => {
  if (!command) return false;
  const isGradleAssemble = /gradlew(\.bat)?[^\n]*\bassemble\w*/i.test(command);
  const isEasBuild = /\beas\s+build\b/i.test(command);
  return isGradleAssemble || isEasBuild;
};

const bumpPatch = (version) => {
  const parts = String(version || '0.0.0').split('.').map((n) => parseInt(n, 10) || 0);
  while (parts.length < 3) parts.push(0);
  parts[2] += 1;
  return parts.slice(0, 3).join('.');
};

const main = (input) => {
  let payload;
  try {
    payload = JSON.parse(input);
  } catch (error) {
    return; // stdin vazio ou inválido — não bloqueia o comando original.
  }

  const command = payload?.tool_input?.command || '';
  if (!isBuildCommand(command)) return;

  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
  const app = JSON.parse(fs.readFileSync(APP_JSON, 'utf8'));

  const newVersion = bumpPatch(pkg.version);
  pkg.version = newVersion;

  app.expo = app.expo || {};
  app.expo.version = newVersion;
  app.expo.android = app.expo.android || {};
  const newVersionCode = (app.expo.android.versionCode || 0) + 1;
  app.expo.android.versionCode = newVersionCode;

  fs.writeFileSync(PACKAGE_JSON, JSON.stringify(pkg, null, 2) + '\n');
  fs.writeFileSync(APP_JSON, JSON.stringify(app, null, 2) + '\n');

  console.error(`[bump-version] ${newVersion} (versionCode ${newVersionCode})`);
};

let input = '';
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => main(input));
process.stdin.on('error', () => {});
