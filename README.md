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
- Os jutsus do clã liberam com o nível (aba **Jutsus**, na mochila). Travado, o botão mostra 🔒 e o nível.
- Uchiha: Bola de Fogo (Nv 1) · Sharingan no botão do meio, liga/desliga, gasta chakra por segundo (1 tomoe Nv 5, 2 tomoe Nv 15, 3 tomoe Nv 25). Ao ligar, o olhar paralisa quem está no cone à frente (menos tempo quanto mais esquiva o alvo tem; no PvP no máx. 1,5 s).
- Nv 40: o jogador escolhe a Mangekyō (Itachi, Sasuke ou Madara), que toma o lugar do Sharingan. Nv 60: Susanoo no botão grande, só com a Mangekyō ligada (cada olho tem o seu). Desligar a Mangekyō desfaz o Susanoo. Arte em `arte/susanoo/`.
- Hyuga: Palma (Nv 1) · Kaiten (Nv 10) · 64 Palmas (Nv 25). Nara: Shuriken (Nv 1) · Sombra (Nv 10) · Possessão (Nv 25).
- 4º botão: habilidade do item equipado (Chidori…). Sem item que dê habilidade, ele aparece vazio.
- Reforços somam entre si e aparecem embaixo das barras com o tempo que falta.
- A escolha da Mangekyō fica na coluna `mangekyo` (`sql/06_mangekyo.sql`). Sem esse SQL o jogo funciona, mas a escolha fica salva só no celular.

## Código do jogo e testes
- O código-fonte está em `src/` (veja `src/LEIA.md`). `bash src/build.sh` monta `www/` e os `server/*.json`.
- `bash tests/rodar.sh` roda os testes no navegador (offline e online, com banco simulado e servidor local).

## Mobs
- Criados no editor (aba Mobs) e colocados nos mapas com a ferramenta Mobs (áreas).
- O servidor controla todos: `server/mobs.json` (atributos) e `server/maps.json` (áreas).
