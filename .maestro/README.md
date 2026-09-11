# Fluxos de UI (Maestro)

Guia completo — instalação, como rodar pelo Android Studio, o que cada fluxo
cobre e por que `03-teclado.yaml` é o mais importante — está em
[`TESTING_GUIDE.md`](../TESTING_GUIDE.md) na raiz do projeto.

Resumo rápido:

```bash
npm run test:ui                          # todos os fluxos
maestro test .maestro/03-teclado.yaml    # um fluxo só
npm run test:ui:studio                   # modo interativo
```

Precisa de um emulador/aparelho com o app instalado e do CLI do Maestro no
PATH (`maestro --version` para conferir).
