# Código-fonte do Shinobi Online

Tudo que monta o `www/game.html` (o jogo) e os dados do servidor (`server/maps.json`, `mobs.json`, `items.json`).

## Montar
```
bash src/build.sh                    # jogo de produção em www/ + server/*.json
bash src/build.sh --teste tests/paginas   # só as páginas de teste (offline e online local)
```
Precisa de Python 3 (com Pillow só para as ferramentas de arte), Node 18+ e Playwright com Chromium
(`PLAYWRIGHT=/caminho/para/playwright` se não estiver em `/opt/npm-tools/node_modules/playwright`).

## Etapas (na ordem)
1. **Jogo base** (`build_all.sh`): parte de `index_before_manto.html` e aplica
   `build_game.py` (mapas do editor `ed/db/maps`, objetos `assets_all.js`, catálogo `ed/catalog.json`),
   `build_manto.py` (itens do editor `ed/db/items`, efeitos em `manto/`) e `build_land.py`.
   Resultado: `gerado/base.html` (não vai para o Git).
2. **Mobs** (`build_mobs.py`): `mobs/mobs_default.json` + atributos do editor `ed/db/mobs` → `server/mobs.json`
   e o que o jogo desenha (`mobs/mobs_client.json`, `mobs/sprites_used.json`, gerados).
3. **Mapas do servidor** (`online/exportmaps.js`): lê os mapas do jogo base → `server/maps.json`.
4. **Itens do servidor**: `ed/db/items/*.json` → `server/items.json`.
5. **Modo online** (`build_online2.py`): injeta `online/online2.js` no jogo base e faz as trocas pontuais
   (`rep(antes, depois)`, que confere quantas vezes o trecho aparece e para se não bater).
   Dados embutidos: sprites do Hyuga/Uchiha (`hyuga/`), efeitos dos golpes (`kaiten/kfx.json`),
   efeitos do Susanoo (`sus/sfx.json`, `sus/icons.json`).
6. **Carregador e versão**: `online/loader.html` → `www/index.html`; `www/version.json` com a versão
   (data e hora UTC) e o SHA-256, para a atualização automática.

## Onde mexer
- Golpes, aba Jutsus, PvP, proficiência, interface online: `online/online2.js`.
- Trocas no jogo base: `build_online2.py` (sempre com `rep`).
- Mapas, itens e mobs: pelo editor (exporta para `ed/db/`).
- Servidor: `server/server.js` (fora de `src/`, é o que o Render roda).
