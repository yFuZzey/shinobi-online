-- =====================================================================
-- Shinobi Online · contrato de invocação (Sapos, Lesmas, Cobras…)
-- Rode no SQL Editor do Supabase (pode rodar de novo sem estragar).
-- Sem isto o jogo funciona, mas o contrato fica salvo só no celular.
-- =====================================================================

-- 1) colunas novas no personagem (vazio = ainda não escolheu)
alter table public.personagens add column if not exists contrato text;
alter table public.personagens add column if not exists contrato_em timestamptz;

-- 2) só aceita as famílias que existem (as que ainda não têm arte já ficam na lista)
alter table public.personagens drop constraint if exists personagens_contrato_ok;
alter table public.personagens add constraint personagens_contrato_ok
  check (contrato is null or contrato in ('sapo', 'lesma', 'cobra', 'corvo', 'falcao', 'cao', 'cervo'));

-- 3) o jogo pode gravar essas colunas (o resto da segurança continua igual)
grant insert (contrato, contrato_em), update (contrato, contrato_em) on public.personagens to authenticated;

-- 4) avisa a API do Supabase que existem colunas novas
notify pgrst, 'reload schema';
