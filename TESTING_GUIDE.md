# Guia de Testes - MoneyGen

O projeto tem três camadas de verificação, cada uma pegando um tipo diferente
de bug. Nenhuma substitui a outra:

| Camada | Comando | O que roda | O que pega |
|---|---|---|---|
| **Motor do assistente** | `npm run check-assistant` | Node puro, sem app | Classificação de intenção e extração de entidade do chat |
| **Jest + Testing Library** | `npm test` | Componentes em memória (sem emulador) | Lógica de tela, estado, renderização condicional |
| **Maestro** | `npm run test:ui` | App de verdade num emulador/aparelho | Layout, teclado, tema, integração real com o banco |

Regra prática: se o bug é "a tela calculou/mostrou a coisa errada", é Jest. Se
é "a coisa certa apareceu no lugar errado da tela" ou "sumiu atrás do
teclado", só o Maestro enxerga.

## Pré-requisitos

- **Jest**: nenhum — já está instalado (`jest`, `jest-expo`,
  `@testing-library/react-native` em `devDependencies`).
- **Maestro**: precisa do CLI instalado uma vez por máquina (veja abaixo) e de
  um emulador rodando para os fluxos de UI.

---

## Camada 1 — Motor do assistente (`npm run check-assistant`)

```bash
npm run check-assistant
```

Roda em Node puro — sem Jest, sem React Native, sem emulador — porque nada em
`utils/assistant/entities/`, `resolver.js`, `intents/` ou `utils/analytics.js`
importa `database/` ou `react-native`. O script
(`scripts/check-assistant.mjs`) monta um banco falso e passa cada frase de
`utils/assistant/__fixtures__/phrases.js` pelo pipeline completo
(normalização → extração de entidade → classificação → execução), conferindo:

- se a frase caiu na intenção certa;
- se os valores/categorias/parcelas extraídos batem com o esperado;
- se todo resultado tem texto e blocos (nenhuma intenção devolve bolha vazia);
- se um comando de escrita (`add_expense`, `add_income`, `pay_bill`) sempre
  produz uma ação pendente, nunca grava direto.

Ao adicionar uma intenção nova ou mexer no resolvedor, adicione o par
`{ text, intentId }` em `phrases.js` antes de mexer no código — é o jeito mais
rápido de saber se a mudança confundiu alguma frase existente.

---

## Camada 2 — Jest + React Native Testing Library (`npm test`)

```bash
npm test              # roda uma vez
npm run test:watch    # fica observando os arquivos
npx jest caminho/do/arquivo.test.js       # um arquivo só
npx jest -t "nome do teste"               # um teste só, por nome
```

### Onde estão os testes

```
utils/__tests__/chatHistory.test.js       # abas de conversa, títulos, poda, degradação de status
utils/__tests__/chatTips.test.js          # regras da dica do momento (prioridade e determinismo)
utils/__tests__/speech.test.js            # preparo do texto para a voz e preferência salva
components/__tests__/ChatBubble.test.js   # cada tipo de bloco, os 4 selos de confirmação
components/__tests__/ChatScreen.test.js   # fluxo completo: perguntar, confirmar, duplo toque, teclado, abas, voz
```

`jest.setup.js` mocka os módulos nativos que o app inteiro arrasta na cadeia
de imports (`AsyncStorage`, `expo-notifications`, `expo-secure-store`,
`expo-local-authentication`, `expo-speech`, `@expo/vector-icons`,
`react-native-safe-area-context`, `@react-navigation/native`) — sem isso o
Jest quebra antes de renderizar qualquer componente.

### Duas armadilhas da versão instalada (Testing Library 14)

1. **`render` é assíncrono e não devolve mais as queries.** Elas vivem só no
   `screen`, que só fica populado depois do `await`:

   ```js
   await render(<Tela />);
   screen.getByText('...');       // certo
   const view = render(<Tela />); // view.getByText não existe mais
   ```

   Se um teste morrer com `render function has not been called`, é sinal de
   que faltou o `await` no `render`.

2. **`fireEvent.changeText` também precisa de `act`.** Sem ele o estado do
   campo não assenta antes do próximo toque, e o botão dispara com a closure
   antiga (ex.: manda enviar texto vazio mesmo depois de digitar algo):

   ```js
   await act(async () => { fireEvent.changeText(input, 'texto'); });
   await act(async () => { fireEvent.press(botaoEnviar); });
   ```

### O teste que importa mais

`ChatScreen.test.js` tem "dois toques rápidos no Confirmar gravam uma vez só"
— ele existe porque `addTransaction` não é idempotente (diferente de
`markBillAsPaid`, que mascararia o bug). Para confirmar que o teste pega o
problema de verdade (e não passaria de qualquer jeito), removi as duas
travas do `ChatScreen` e rodei de novo: o teste falhou com
`Expected 1, Received 3`. Com as travas de volta, passa. Se for mexer nesse
fluxo, vale repetir esse truque antes de confiar no teste.

### O teste do teclado (bug real, corrigido)

O `describe('teclado', ...)` em `ChatScreen.test.js` nasceu de um bug relatado
em produção: com o teclado aberto, o campo de texto do chat ficava atrás dele
e o usuário não via o que estava digitando. Causa: `edgeToEdgeEnabled=true`
(`android/gradle.properties`) faz o Android não redimensionar a janela — o
`adjustResize` do manifesto não tem efeito, e sem medir a altura do teclado
manualmente o `paddingBottom` do composer nunca cresce.

O teste mocka `Keyboard.addListener` com `jest.spyOn` para capturar os
handlers que o `ChatScreen` registra, sem depender do emissor nativo real
(que não roda sob Jest):

```js
jest.spyOn(Keyboard, 'addListener').mockImplementation((eventName, handler) => {
  handlers[eventName] = handler;
  return { remove: jest.fn() };
});
```

e depois chama esse handler diretamente para simular o evento
(`handler({ endCoordinates: { height: 320 } })`), conferindo que
`paddingBottom` do composer (via `testID="chat-composer"`) sobe para
acompanhar o teclado — e que usa `Math.max`, não soma, com o padding da safe
area.

Confirmei que o teste pega o bug de verdade: revertendo a correção (voltando
o padding para só `insets.bottom + r.space(8)`, ignorando o teclado), dois dos
cinco testes falham. Com a correção, os cinco passam.

**O que esse teste não cobre**: ele verifica a aritmética e o wiring do
estado, não a renderização real na tela — não sabe se o valor calculado
realmente empurra o campo para cima do teclado em pixels de verdade. Essa
prova continua sendo trabalho do `03-teclado.yaml` do Maestro (Camada 3),
rodando no aparelho real.

### Escrevendo um teste novo

- Componente novo → arquivo em `<pasta>/__tests__/Nome.test.js`, seguindo o
  padrão de `ChatBubble.test.js` (tema e `r` falsos vêm de
  `utils/__tests__/testTheme.js`).
- Lógica pura (util) → `utils/__tests__/nome.test.js`, sem precisar renderizar
  nada.
- Sempre `await render(...)`, sempre `screen.*` (nunca a query devolvida pelo
  `render`), sempre `act` em volta de qualquer evento que dispare `setState`.

---

## Camada 3 — Maestro (`npm run test:ui`)

Testa o app rodando de verdade — é o que enxerga teclado, layout e tema, que
o Jest não vê porque roda em memória.

### Instalação (já feita nesta máquina)

O CLI já está instalado e no PATH (Windows e Git Bash). Para reinstalar ou
instalar em outra máquina, pelo Git Bash:

```bash
curl -fsSL "https://get.maestro.mobile.dev" | bash
```

Exige `java` (o projeto já usa JDK 17) e `unzip` (vem com o Git Bash). O
instalador baixa o zip de https://github.com/mobile-dev-inc/maestro/releases,
extrai em `~/.maestro` e ajusta o PATH do `.bashrc`/`.zshrc`. Depois de
instalar, abra um terminal novo e confirme:

```bash
maestro --version
```

> Se você achar `get.maestro.dev/install.ps1` em algum lugar, ignore — esse
> domínio não existe. O instalador oficial roda em Bash, inclusive no
> Windows (via Git Bash).

### Rodando pelo Android Studio

1. Abra o **Device Manager** do Android Studio e suba um emulador (ou
   conecte um aparelho físico com depuração USB ativada).
2. Confirme que ele aparece: `adb devices`.
3. Instale o app nele — qualquer um dos caminhos:

   ```bash
   npm run android                      # builda e instala via Metro
   # ou, com um APK já pronto:
   adb install -r android/app/build/outputs/apk/release/app-release.apk
   ```

4. Rode os fluxos (pode ser no terminal do Android Studio, PowerShell ou Git
   Bash — o `maestro` está no PATH dos três):

   ```bash
   npm run test:ui                          # todos os fluxos, em ordem
   maestro test .maestro/03-teclado.yaml    # um fluxo só
   npm run test:ui:studio                   # modo interativo, para gravar fluxo novo
   ```

Os screenshots (`takeScreenshot` nos fluxos) saem na pasta onde o comando foi
executado.

### O que cada fluxo cobre

| Fluxo | Cobre |
|---|---|
| `01-abrir-assistente.yaml` | Entrada pelo menu lateral e o cardápio de capacidades do estado vazio |
| `02-perguntar.yaml` | Pergunta por chip e por digitação |
| `03-teclado.yaml` | **O risco principal** — ver abaixo |
| `04-gravar-despesa.yaml` | Gravação ponta a ponta: confirma → vira selo → o lançamento aparece em Transações |
| `05-cancelar.yaml` | Cancelar não grava, e a bolha diz isso explicitamente |
| `06-tema-claro.yaml` | Bolha do assistente continua visível no tema claro |
| `07-abas-e-voz.yaml` | Trocar de aba preserva cada conversa; ligar a voz não quebra o fluxo |

Os alvos usam `testID` (`chat-input`, `chat-send`, `chat-confirm`,
`chat-cancel`) definidos em `ChatScreen.js` e `ChatBubble.js`, para não
depender de texto traduzível.

### Por que o fluxo do teclado é o mais importante

`android/gradle.properties` tem `edgeToEdgeEnabled=true`, o que muda o
significado do `android:windowSoftInputMode="adjustResize"` do manifesto: no
Android 15 a janela não é redimensionada, o teclado chega como *inset*. Se o
composer do chat ficar atrás dele, `03-teclado.yaml` falha no
`assertVisible: id: chat-send` com o teclado aberto.

Se isso acontecer, o conserto é um listener de
`Keyboard.addListener('keyboardDidShow'/'keyboardDidHide', ...)` em
`ChatScreen.js` aplicando
`paddingBottom: Math.max(alturaTeclado, insets.bottom + r.space(8))`.
**Somar os dois valores em vez de usar `Math.max` é o bug** — sobra o dobro
do espaço embaixo do composer.

---

## Rodando tudo antes de um build

```bash
npm run check-assistant   # ~1s, motor do chat
npm test                  # ~5s, componentes e lógica
npm run test:ui           # alguns minutos, precisa de emulador rodando
```

As duas primeiras não têm custo — vale rodar sempre antes de commitar mudança
em `utils/assistant/`, `ChatScreen.js` ou `ChatBubble.js`. A terceira é mais
pesada; roda pelo menos antes de gerar um APK de release
(`npm run build:apk-release`).
