# Servidor do Shinobi Online

Node puro, sem dependências. Roda no Render (plano grátis) via `render.yaml`.

- `GET /health` → status, versão (commit) e jogadores online.
- `WS /ws` → protocolo do jogo (JSON). Primeiro a mensagem `auth` com o token do Supabase.
- `maps.json` → grade de colisão de cada mapa (gerada a partir do jogo).
- `items.json` → itens e chance de drop.

Regras ajustáveis no topo de `server.js` (objeto `CFG`): alcance de perseguição, reset, XP, tamanho do grupo etc.

## Editor de mapas (`/painel/mapas`)
- Abre no navegador do celular, no mesmo login do `/painel` (conta admin). Cria/edita mapas e **Publicar** grava na tabela `mapas` (rode `sql/11_mapas.sql` uma vez no Supabase).
- O servidor relê os mapas publicados a cada 1 min (ou na hora, quando o editor avisa em `POST /painel/recarregar`): refaz a colisão (`mapas_regras.js` + `mapa_objetos.json`, gerado junto com `maps.json`) e cria os mobs das áreas.
- `GET /mapas` entrega os publicados ao jogo, que mostra na lista de mapas (por enquanto só admin abre outras vilas).
- Os mapas que já vêm no jogo (`konoha`, `vila_areia`) não são trocados pelo painel.
