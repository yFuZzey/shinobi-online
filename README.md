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

## Mobs
- Criados no editor (aba Mobs) e colocados nos mapas com a ferramenta Mobs (áreas).
- O servidor controla todos: `server/mobs.json` (atributos) e `server/maps.json` (áreas).
