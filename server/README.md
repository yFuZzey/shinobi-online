# Servidor do Shinobi Online

Node puro, sem dependências. Roda no Render (plano grátis) via `render.yaml`.

- `GET /health` → status, versão (commit) e jogadores online.
- `WS /ws` → protocolo do jogo (JSON). Primeiro a mensagem `auth` com o token do Supabase.
- `maps.json` → grade de colisão de cada mapa (gerada a partir do jogo).
- `items.json` → itens e chance de drop.

Regras ajustáveis no topo de `server.js` (objeto `CFG`): alcance de perseguição, reset, XP, tamanho do grupo etc.
