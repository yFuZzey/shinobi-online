# Shinobi Online

MMORPG 2D no universo Naruto (protótipo).

- O jogo inteiro está em `www/index.html`.
- A cada envio para a branch `main`, o GitHub gera o APK automaticamente (aba **Actions**).
- Para baixar: **Releases** → `shinobi-online.apk`.

## Online
- Servidor: Supabase (contas, tabela `personagens`, canais em tempo real). Configuração pública em `online.json`.
- A cada envio, o teste `tests/smoke.mjs` verifica contas, banco e tempo real (job **teste-online**).
- Versão de navegador (GitHub Pages), quando ativada: job **site**.

## Banco de dados
- `personagens`: uma coluna por informação (cla, nivel, xp, pontos, forca, agilidade, vitalidade, inteligencia, destreza, sorte, mapa, pele, cabelo, roupa, admin).
- `inventario`: uma linha por item (personagem_id, item, equipado).
- SQL de criação/atualização em `sql/`. Edite de preferência com o jogador fora do jogo.
- `trocas`: histórico das trocas entre jogadores.

## Trocas e itens (anti-duplicação)
- O app só lê a mochila e marca equipado/desequipado. Criar, dar e trocar itens é só pelo servidor do jogo, com a chave secreta `SUPABASE_SERVICE_KEY` (variável no Render, nunca no código).
- Cada linha de `inventario` é 1 unidade: dá para ter vários do mesmo item (a mochila mostra pilhas ×N).
- Na troca, cada jogador escolhe quais itens e quantas unidades manda (até 6 tipos); pode ser só de um lado (presente).
- Ao confirmar, o banco (`trocar_itens`) muda o dono de todas as unidades escolhidas de uma vez: nunca fica metade feita.
- Ativar: chave no Render → rodar `sql/04_trocas.sql` no Supabase.

## PvP
- Quem não está no mesmo grupo pode se atacar. Zona segura em volta do ponto de início (4 tiles).
- O servidor confere mapa, distância, grupo e zona segura; o alvo sorteia a esquiva e devolve o resultado.
- Ajustes em `server/server.js` (`CFG.pvp`, `pvpMul` = 60% do dano, `pvpSafe`, `pvpStun`).

## Mobs
- Criados no editor (aba Mobs) e colocados nos mapas com a ferramenta Mobs (áreas).
- O servidor controla todos: `server/mobs.json` (atributos) e `server/maps.json` (áreas).
