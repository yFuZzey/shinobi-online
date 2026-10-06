-- =====================================================================
-- Shinobi Online · proficiência (Taijutsu, Ninjutsu, Genjutsu, Bukijutsu)
-- Rode UMA vez no SQL Editor do Supabase (pode rodar de novo sem estragar).
-- =====================================================================

-- 1) duas colunas novas no personagem
alter table public.personagens
  add column if not exists proficiencia text,
  add column if not exists prof_xp      int not null default 0;

-- 2) só aceita os 4 tipos (ou vazio = ainda não escolheu) e XP nunca negativa
alter table public.personagens drop constraint if exists personagens_proficiencia_ok;
alter table public.personagens add constraint personagens_proficiencia_ok
  check (proficiencia is null or proficiencia in ('taijutsu', 'ninjutsu', 'genjutsu', 'bukijutsu'));
alter table public.personagens drop constraint if exists personagens_prof_xp_ok;
alter table public.personagens add constraint personagens_prof_xp_ok check (prof_xp >= 0);

-- 3) o jogo pode gravar essas duas colunas (o resto da segurança continua igual)
grant insert (proficiencia, prof_xp), update (proficiencia, prof_xp) on public.personagens to authenticated;

-- 4) avisa a API do Supabase que existem colunas novas
notify pgrst, 'reload schema';
