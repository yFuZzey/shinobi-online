-- =====================================================================
-- Shinobi Online · visual no corpo dos itens do painel (capa, arma nas costas, chapéu…)
-- Rode no SQL Editor do Supabase (pode rodar de novo sem estragar). Precisa do sql/09_itens.sql antes.
-- =====================================================================
alter table public.itens add column if not exists visual  text check (visual  is null or (visual  like 'data:image/%' and char_length(visual)  <= 120000));
alter table public.itens add column if not exists visual2 text check (visual2 is null or (visual2 like 'data:image/%' and char_length(visual2) <= 120000));
alter table public.itens add column if not exists vis     jsonb not null default '{}'::jsonb;
notify pgrst, 'reload schema';
