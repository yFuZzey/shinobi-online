-- =====================================================================
-- Shinobi Online · TREINO POR TIPO DE GOLPE (Taijutsu, Ninjutsu, Genjutsu, Bukijutsu)
-- Uma coluna nova no personagem com a XP de treino de cada tipo: {"taijutsu": 120, "ninjutsu": 40, ...}
-- Rode UMA vez no SQL Editor do Supabase (pode rodar de novo sem estragar).
-- =====================================================================
alter table public.personagens add column if not exists treino jsonb not null default '{}'::jsonb;
alter table public.personagens drop constraint if exists personagens_treino_ok;
alter table public.personagens add constraint personagens_treino_ok check (jsonb_typeof(treino) = 'object' and pg_column_size(treino) <= 2000);
grant insert (treino), update (treino) on public.personagens to authenticated;
notify pgrst, 'reload schema';
