# Shinobi Online

MMORPG 2D no universo Naruto (protótipo).

- O jogo inteiro está em `www/index.html`.
- A cada envio para a branch `main`, o GitHub gera o APK automaticamente (aba **Actions**).
- Para baixar: **Releases** → `shinobi-online.apk`.

## Online
- Servidor: Supabase (contas, tabela `personagens`, canais em tempo real). Configuração pública em `online.json`.
- A cada envio, o teste `tests/smoke.mjs` verifica contas, banco e tempo real (job **teste-online**).
- Versão de navegador (GitHub Pages), quando ativada: job **site**.
