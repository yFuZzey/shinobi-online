-- =====================================================================
-- Shinobi Online · Mangekyō escolhida (Itachi, Sasuke ou Madara)
-- Rode no SQL Editor do Supabase (pode rodar de novo sem estragar).
-- Sem isto o jogo funciona, mas a escolha do olho fica salva só no celular.
-- =====================================================================

-- 1) coluna nova no personagem (vazia = ainda não escolheu)
alter table public.personagens add column if not exists mangekyo text;

-- 2) só aceita os 3 olhos que existem hoje
alter table public.personagens drop constraint if exists personagens_mangekyo_ok;
alter table public.personagens add constraint personagens_mangekyo_ok
  check (mangekyo is null or mangekyo in ('itachi', 'sasuke', 'madara'));

-- 3) o jogo pode gravar essa coluna (o resto da segurança continua igual)
grant insert (mangekyo), update (mangekyo) on public.personagens to authenticated;

-- 4) avisa a API do Supabase que existe coluna nova
notify pgrst, 'reload schema';
