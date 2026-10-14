# Servidor do Shinobi Online

Node puro, sem dependências. Roda no Render (plano grátis) via `render.yaml`.

- `GET /health` → status, versão (commit) e jogadores online.
- `WS /ws` → protocolo do jogo (JSON). Primeiro a mensagem `auth` com o token do Supabase.
- `maps.json` → grade de colisão de cada mapa (gerada a partir do jogo).
- `items.json` → itens e chance de drop.

Regras ajustáveis no topo de `server.js` (objeto `CFG`): alcance de perseguição, reset, XP, tamanho do grupo etc.

## Editor novo (`/painel/editor`) — em construção por fases
- Arquivos em `server/editor/`: `index.html`/`estilo.css` (tela), `ui.js` (interface), `modelo.js` (modelo do mapa: criar, ler/gravar o formato do jogo sem perder campos, redimensionar, conferir), `persist.js` (rascunhos no aparelho em IndexedDB com 5 cópias de segurança + recuperação; publicar no Supabase), `render.js` (desenho igual ao jogo), `jogo.js` (gerado no build por `src/editor_jogo.py`: imagens, catálogo e mapas do jogo). A colisão usa o próprio `mapas_regras.js` do servidor.
- **Tamanho dos mapas:** largura × altura de 20 a 100 tiles por lado, no máximo 6.400 tiles (memória do celular). Campos `W`/`H` no JSON; sem eles o mapa é 50×50 (os antigos não mudam). O jogo e o servidor leem esse tamanho (borda de 2 tiles sempre bloqueada). Apps antigos não recebem mapas de outro tamanho (`/mapas` sem `dim=1`).
- **Tile lógico continua 32 px** (movimento, colisão e sprites dependem disso). O “tile da arte” do editor é o tamanho dos tiles dos tilesets, desenhados no tamanho original.
- **Publicar não sobrescreve em silêncio:** mapa novo = inserção (avisa se o identificador já existe); mapa existente = só grava se ninguém mudou desde que foi aberto (`atualizado_em`); senão pede confirmação.
- **Biblioteca de recursos (Fase 2):** tabela `mapa_recursos` (`sql/17_mapa_recursos.sql`, só admin lê/grava). Cada imagem importada guarda o **original sem alteração** em `originais/<hash>` no Storage; se o fundo for removido, o editor usa uma **cópia** em `derivados/<hash>.png`. Grade, recortes (x, y, largura, altura no original) e categoria/coleção são só metadados. `recursos.js` (dados, fundo, detecção de peças), `visor.js` (zoom/pinça/arrasto/seleção com alças) e `ui_recursos.js` (telas). Tilesets e imagens do editor antigo podem ser “trazidos” sem reenviar arquivo.
- **Pintura (Fase 3):** `ferramentas.js` (pincel, borracha, balde, retângulo/contorno, seleção copiar/colar/duplicar/mover/apagar) para terreno, colisão e camadas de tiles. Camadas de tiles têm `z` ('baixo' = por baixo dos objetos, 'acima' = por cima do personagem) e `nome`; a ordem da lista é a ordem de desenho (o jogo respeita). Tilesets podem ser `t_…` (editor antigo) ou `r_…` (biblioteca; o servidor lê `mapa_recursos`). Conjuntos reutilizáveis ficam em `mapa_conjuntos` (`sql/18_mapa_conjuntos.sql`).
- **Estruturas (Fase 4):** cada recorte da biblioteca vira um objeto `recurso.recorte` (ex.: `r_arvores.c1`): pedaço do arquivo (x, y, w, h), tamanho no mapa (dw, dh), âncora (ax, ay = ponto no chão), `corte` (px do topo acima dos quais o desenho fica na frente do personagem, sem duplicar a imagem) e colisão padrão (`col`, tiles a partir da âncora). No mapa, cada objeto guarda em `r[4]` a sua colisão e em `r[5]` `{e: escala, z: 'chao'|'acima', b: ajuste da ordem}`; o servidor e o jogo usam os mesmos dados. A grade dos tilesets tem início X/Y separado (`mg`/`my`). O editor antigo recusa mapas com `ed` (salvos pelo editor novo) para não apagar dados.
- **Limitação conhecida:** o servidor confere a posição dos jogadores só pelos limites do mapa (não refaz o caminho com colisão); a colisão fina é do app, como antes.

## Mapas publicados (o editor antigo `/painel/mapas` foi removido; o endereço leva ao editor novo `/painel/editor`)
- **Publicar** no editor grava na tabela `mapas` (rode `sql/11_mapas.sql` uma vez no Supabase).
- O servidor relê os mapas publicados a cada 1 min (ou na hora, quando o editor avisa em `POST /painel/recarregar`): refaz a colisão (`mapas_regras.js` + `mapa_objetos.json`, gerado junto com `maps.json`) e cria os mobs das áreas.
- `GET /mapas` entrega os publicados ao jogo, que mostra na lista de mapas (por enquanto só admin abre outras vilas).
- Os mapas que já vêm no jogo (`konoha`, `vila_areia`) não são trocados pelo painel.
- **Imagens próprias:** no editor, Objetos → **+ Importar PNG** (tira o fundo, corta, ajusta tamanho e base de colisão). Ficam na tabela `mapa_imagens` (`sql/12_mapa_imagens.sql`), aparecem na aba *Meus* e vão para o jogo junto com os mapas que as usam.
