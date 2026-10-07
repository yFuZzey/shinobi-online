# Susanoo (efeitos)

`folha_original.png` é a folha enviada com as auras do Sasuke (roxo), do Itachi (vermelho) e do Madara (armadura), mais faíscas e a explosão geral.

Como entra no jogo:
- `ferramentas/recortar_susanoo.py` separa cada quadro e tira o fundo xadrez e a sombra escura em volta.
- `ferramentas/atlas_susanoo.py` junta tudo em `atlas.png` (no jogo vai em WebP) e gera os ícones dos itens.

Uso hoje:
- Itens da mão **Susanoo (Sasuke)**, **Susanoo (Itachi)** e **Susanoo (Madara)**, pelo 4º botão.
- Cada um faz: surgir, atacar em área, ficar de pé em volta do ninja (atrás dele, acompanhando cada passo) e desfazer.
- A ultimate **Mangekyō Sharingan** usa a explosão vermelha e as faíscas.

Mais tarde, a missão da Mangekyō vai definir qual Susanoo cada jogador libera.
