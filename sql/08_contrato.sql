-- =====================================================================
-- Shinobi Online · contrato de invocação (Corvos, Falcões, Cães, Sapos, Lesmas, Cervos ou Cobras)
-- Rode no SQL Editor do Supabase (pode rodar de novo sem estragar).
-- Sem isto o jogo funciona, mas o contrato fica salvo só no celular.
-- =====================================================================

-- 1) coluna nova no personagem (vazia = ainda não assinou)
alter table public.personagens add column if not exists contrato text;

-- 2) só aceita as famílias que existem hoje
alter table public.personagens drop constraint if exists personagens_contrato_ok;
alter table public.personagens add constraint personagens_contrato_ok
  check (contrato is null or contrato in ('corvos', 'falcoes', 'caes', 'sapos', 'lesmas', 'cervos', 'cobras'));

-- 3) o jogo pode gravar essa coluna (o resto da segurança continua igual)
grant insert (contrato), update (contrato) on public.personagens to authenticated;

-- 4) avisa a API do Supabase que existe coluna nova
notify pgrst, 'reload schema';
