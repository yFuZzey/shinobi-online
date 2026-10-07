# Invocações (contratos)

Folhas enviadas para a Entrega 11 (planilha 11):
- `folha_sapo.png` — Gamabunta: corrida, golpe do sabre, poeira, fumaça da invocação e a revelação no meio da fumaça.
- `folha_lesma.png` — Katsuyu: andar, cura, aura de cura, campo no chão, fumaça/materialização, chegada e saída.
- `folha_cobra.png` — Manda: deslizar, bote, mordida, fumaça de chakra, selo de invocação e pulso de chakra.

Como entra no jogo:
- `ferramentas/recortar_invocacoes.py` (rodar de dentro desta pasta) separa cada quadro, tira o fundo e os nomes
  dos quadros ("A1", "B2"…), junta tudo em `atlas.png` (no jogo vai em WebP) e grava `src/inv/ifx.json` e os ícones (`src/inv/icons.json`).
- As caixas de cada quadro e a escala no jogo estão no começo do script.

Uso hoje:
- **Sapo (Gamabunta)**: surge na fumaça ao lado do ninja e fica de guarda; o escudo segura os golpes (ele defende com o sabre).
- **Lesma (Katsuyu)**: chega na fumaça, brilha e cura aos poucos; o campo de cura fica no chão em volta do ninja.
- **Cobra (Manda)**: o selo aparece embaixo do alvo, ela sai da fumaça, dá o bote e envenena.

Ainda sem arte (aparecem como "em breve"): corvos, falcões, cães ninja e cervos.
