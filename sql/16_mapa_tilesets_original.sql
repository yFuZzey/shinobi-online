-- =====================================================================
-- Shinobi Online · tilesets com remoção de fundo por cor: o arquivo ORIGINAL enviado fica guardado sem alteração
-- (coluna "original"); a coluna "arquivo" passa a ser a cópia com transparência usada no jogo.
-- Rode no SQL Editor (pode rodar de novo). Precisa do SQL 15. Tilesets antigos continuam iguais (original = vazio).
-- =====================================================================
alter table public.mapa_tilesets add column if not exists original text check (original is null or original ~ '^originais/[a-f0-9]{12}\.(png|webp|jpg|gif)$');
notify pgrst, 'reload schema';
