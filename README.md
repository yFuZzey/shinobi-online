# Shinobi Online

MMORPG 2D no universo Naruto (protótipo).

- O jogo inteiro está em `www/index.html`.
- A cada envio para a branch `main`, o GitHub gera o APK automaticamente (aba **Actions**).
- Para baixar: **Releases** → `shinobi-online.apk`.

## Atualização automática (sem reinstalar o APK)
- `www/index.html` é só um carregador: abre a versão mais nova do jogo já baixada no celular ou a `www/game.html` que veio no APK.
- O jogo confere `www/version.json` no GitHub (repositório público), baixa a `game.html` nova, confere o SHA-256 e mostra "Atualizar agora".
- Se uma versão nova não abrir 2 vezes seguidas, o carregador volta sozinho para a do APK.
- APK novo só é preciso quando mudar algo nativo do Android (aí o `loader` do version.json sobe).

## Online
- Servidor: Supabase (contas, tabela `personagens`, canais em tempo real). Configuração pública em `online.json`.
- A cada envio, o teste `tests/smoke.mjs` verifica contas, banco e tempo real (job **teste-online**).
- Versão de navegador (GitHub Pages), quando ativada: job **site**.

## Banco de dados
- `personagens`: uma coluna por informação (cla, nivel, xp, pontos, forca, agilidade, vitalidade, inteligencia, destreza, sorte, mapa, pele, cabelo, roupa, admin).
- `inventario`: uma linha por item (personagem_id, item, equipado).
- SQL de criação/atualização em `sql/`. Edite de preferência com o jogador fora do jogo.
- `trocas`: histórico das trocas entre jogadores.
- `versao` (`sql/07_versao.sql`): versão do formato do personagem. Quando o formato mudar, o jogo converte os saves antigos (função `chMigra` em `src/online/online2.js`); sem a coluna o jogo funciona e guarda a versão no aparelho.

## Trocas e itens (anti-duplicação)
- O app só lê a mochila e marca equipado/desequipado. Criar, dar e trocar itens é só pelo servidor do jogo, com a chave secreta `SUPABASE_SERVICE_KEY` (variável no Render, nunca no código).
- Cada linha de `inventario` é 1 unidade: dá para ter vários do mesmo item (a mochila mostra pilhas ×N).
- Na troca, cada jogador escolhe quais itens e quantas unidades manda (até 6 tipos); pode ser só de um lado (presente).
- Ao confirmar, o banco (`trocar_itens`) muda o dono de todas as unidades escolhidas de uma vez: nunca fica metade feita.
- Ativar: chave no Render → rodar `sql/04_trocas.sql` no Supabase.

## Comandos de admin (no chat, ninguém mais vê)
- `/admin nome`, `/desadmin nome`, `/ban nome [tempo] [motivo]` (tempo: 30m, 2h, 7d; sem tempo = para sempre), `/unban nome`, `/banidos`, `/ajuda`.
- Banimento fica na tabela `banidos` (`sql/05_banimento.sql`), que só o servidor lê e grava.

## PvP
- Quem não está no mesmo grupo pode se atacar. Zona segura em volta do ponto de início (4 tiles).
- O servidor confere mapa, distância, grupo e zona segura, sorteia a esquiva e aplica a redução de dano; o número sai para todos na hora.
- Ajustes em `server/server.js` (`CFG.pvp`, `pvpMul` = 60% do dano, `pvpSafe`, `pvpStun`).

## Golpes (4 botões) e aba Jutsus
- Botão grande = ultimate. Em arco em volta dele: golpe inicial, golpe do meio e o botão do item da mão. Teclado: 1–4.
- **Sua barra** (topo da aba Jutsus): o jogador escolhe os jutsus dos botões 1, 2 e 3 (o 3 é o lugar do item; o item volta quando quiser). O grande só aceita ultimate. Passivas não ocupam botão. A recarga acompanha o jutsu quando ele troca de botão. A escolha fica salva no celular.
- Os jutsus do clã liberam com o nível (aba **Jutsus**, na mochila). Travado, o botão mostra 🔒 e o nível.
- Uchiha: Bola de Fogo (Nv 1) · Sharingan no botão do meio, liga/desliga, gasta chakra por segundo (1 tomoe Nv 5, 2 tomoe Nv 15, 3 tomoe Nv 25). Ao ligar, o olhar paralisa quem está no cone à frente (menos tempo quanto mais esquiva o alvo tem; no PvP no máx. 1,5 s).
- Nv 40: o jogador escolhe a Mangekyō (Itachi, Sasuke ou Madara), que toma o lugar do Sharingan. Nv 60: Susanoo no botão grande, só com a Mangekyō ligada (cada olho tem o seu). Desligar a Mangekyō desfaz o Susanoo. Arte em `arte/susanoo/`.
  Jutsus do Uchiha: Gōkakyū forte (Nv 1: bola grande, explode em área) · Genjutsu: Sharingan (Nv 15: confunde 1,5 s, controles invertidos; passa ao levar dano) · Hōsenka (Nv 20: 5 bolinhas em leque) · Gōryūka (Nv 30: o chão avisa e o dragão cai em área) · Amaterasu (Nv 45, Mangekyō ligada: golpe + 6 queimas) · Tsukuyomi (Nv 50, Mangekyō ligada: atordoa; não pega quem está de costas).
- Hyuga: Palma (Nv 1, queima 2% do chakra do alvo no PvP) · Kaiten (Nv 10, reflete projéteis de jogadores e empurra) · 64 Palmas (Nv 20, sela o chakra de jogadores por 3 s: só jutsus de até 10% do chakra).
  Byakugan (Nv 5: liga/desliga, +10 de precisão, genjutsu 15% mais curto em você, gasta 2% do chakra por segundo) · Hakke Kūshō (Nv 15: palma de vácuo à distância, empurra ~3 tiles) · 128 Palmas (Nv 45: evolução das 64, toma o lugar delas no botão grande; sela 4 s) · Sōjishi (Nv 55: cones para a frente e para trás, deixa 30% lento) · Kaiten Perfeito (Nv 60, ultimate: bloqueia projéteis enquanto gira, golpe em área com a força dividida entre os alvos, sela 4 s).
- Nara: Shuriken (Nv 1) · Sombra/Kagemane (Nv 1: a sombra cresce no chão e prende no lugar por 2 s; o Nara fica parado junto) · Possessão/Kagemane múltiplo (Nv 30: prende até 3 alvos por 1,5 s; no PvP o tempo é dividido entre os jogadores presos).
  Kage Nui (Nv 15: 3 agulhas de sombra que perseguem, dano + 25% mais lento por 1,5 s) · Kubishibari (Nv 20: só em quem está preso na sua sombra; silencia 1,5 s e aperta 4×) · Kageyose (Nv 40: puxa o primeiro inimigo da linha ~3 tiles) · Campo de Sombras (Nv 45: área de 6 s, inimigos lentos, você −10% de dano recebido) · Intelecto Nara (Nv 50, passiva: −10% de recarga nas sombras, controles +15% em monstros) · Domínio das Sombras (Nv 60, ultimate: prende 1,5 s e silencia 1 s todo mundo da área).
- Silenciado = só o golpe básico funciona (não liga olho, não invoca, não usa item). Lento = anda mais devagar. Confuso = controles invertidos até levar dano (monstro: esquece o alvo). No PvP o servidor limita: preso 2 s, silêncio 2 s, lento 2 s / 40%, confusão 1,5 s.
- **Controle no PvP (planilha 09/10, o servidor aplica):** o mesmo tipo (atordoar, prender, silêncio/selo, lento, genjutsu, empurrão forte) repetido em 15 s vale 100% → 75% → 50% → 25% e depois fica imune 3 s (aparece "imune a …"). Vários toques do mesmo golpe contam uma vez. Tenacidade = VIT final × 0,2% (até 30%) encurta tudo. Atordoado seguido: no máximo 4 s. Redução de dano: no máximo 60% somando tudo. Jūken (taijutsu do Hyuga) atravessa 15% da redução; com a Mangekyō ligada, genjutsu atravessa 10%. Números em `server/balanceamento.json` → `cc`.
- **Naturezas (planilha 07, o servidor decide pelo catálogo):** cada jutsu tem natureza (Uchiha: Katon e Yin; Hyuga: Yang e Fūton no Kūshō/Sōjishi; Nara: Yin; Chidori: Raiton). Quem apanha tem a natureza do clã (Uchiha Katon, Hyuga Yang, Nara Yin). Forte ×1,15, fraco ×0,85. Efeito no PvP (só em jutsu, não no golpe básico; no máximo 1 a cada 4 s): Katon queima 3% da vida em 3 s, Fūton atravessa 10% da redução, Raiton paralisa 0,3 s, Suiton deixa 20% lento, Yin faz prender/silenciar/genjutsu durar 10% a mais. Números em `server/balanceamento.json` → `naturezas`.
- **PvP × PvE (planilha 12):** crítico ×1,5 em monstro e ×1,3 em jogador; no PvP o bônus de % de dano dos itens vale no máximo 20% (o Manto da Raposa continua +100% no PvE); no PvP aberto quem tem nível maior bate no máximo 10% a mais do que alguém do nível do alvo (servidor: `pvpNivelBonusMax`, `pvpNivelCurva`; 0 desliga).
- Susanoo: escudo de 25–35% da vida (Itachi o maior) por 8 s, mais lento e sem recuperar vida; quebrou o escudo, ele se desfaz.
- Números de golpes, recargas, custos e efeitos: `server/balanceamento.json`.
- 4º botão: habilidade do item equipado (Chidori…). Sem item que dê habilidade, ele aparece vazio.
- Reforços somam entre si e aparecem embaixo das barras com o tempo que falta.
- A escolha da Mangekyō fica na coluna `mangekyo` (`sql/06_mangekyo.sql`). Sem esse SQL o jogo funciona, mas a escolha fica salva só no celular.

## Código do jogo e testes
- O código-fonte está em `src/` (veja `src/LEIA.md`). `bash src/build.sh` monta `www/` e os `server/*.json`.
- `bash tests/rodar.sh` roda os testes no navegador (offline e online, com banco simulado e servidor local).
- [ADM] Abas Personagem e Jutsus: "Trocar de clã" (só admin) — pede confirmação e começa do zero no clã novo (nível, pontos, especialidade, Mangekyō, barra e mochila).

## Mobs
- Criados no editor (aba Mobs) e colocados nos mapas com a ferramenta Mobs (áreas).
- O servidor controla todos: `server/mobs.json` (atributos) e `server/maps.json` (áreas).
