-- =====================================================================
-- Shinobi Online · versão do personagem salvo
-- Rode no SQL Editor do Supabase (pode rodar de novo sem estragar).
-- Sem isto o jogo funciona; com isto, quando o formato do personagem mudar
-- (ex.: pontos de atributo por nível), o jogo sabe quem precisa ser convertido.
-- =====================================================================

-- 1) coluna nova: quem já existe fica na versão 1 (o formato de hoje)
alter table public.personagens add column if not exists versao int not null default 1;

-- 2) nunca menor que 1
alter table public.personagens drop constraint if exists personagens_versao_ok;
alter table public.personagens add constraint personagens_versao_ok check (versao >= 1);

-- 3) o jogo pode gravar essa coluna (o resto da segurança continua igual)
grant insert (versao), update (versao) on public.personagens to authenticated;

-- 4) avisa a API do Supabase que existe coluna nova
notify pgrst, 'reload schema';
