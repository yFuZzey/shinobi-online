-- =====================================================================
-- Shinobi Online · itens criados no painel (/painel no servidor do jogo)
-- Rode no SQL Editor do Supabase (pode rodar de novo sem estragar).
-- Sem isto o jogo funciona normalmente; só o painel não tem onde gravar.
-- =====================================================================

-- 1) tabela dos itens (os números dos atributos não ficam aqui: o jogo calcula pelo nível e raridade)
create table if not exists public.itens (
  id            text primary key check (id ~ '^p_[a-z0-9_]{2,36}$'),
  nome          text not null check (char_length(btrim(nome)) between 2 and 40),
  icone         text not null check (icone like 'data:image/%' and char_length(icone) <= 60000),
  nivel         int  not null default 1 check (nivel between 1 and 99),
  raridade      text not null check (raridade in ('comum', 'raro', 'epico', 'lendario')),
  slot          text not null check (slot in ('capa', 'arma', 'mao', 'cabeca', 'acessorio')),
  tipo          text not null default 'status' check (tipo in ('status', 'habilidade', 'nova')),
  habilidade    text,
  pedido        text check (pedido is null or char_length(pedido) <= 600),
  atributos     text[] not null default '{}' check (cardinality(atributos) between 1 and 4),
  descricao     text not null default '' check (char_length(descricao) <= 300),
  publicado     boolean not null default false,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- 2) quem é admin (coluna "admin" do personagem)
create or replace function public.eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select admin from public.personagens where id = auth.uid()), false)
$$;
revoke all on function public.eh_admin() from public;
grant execute on function public.eh_admin() to anon, authenticated;

-- 3) segurança: todo mundo lê os publicados; só admin vê rascunhos e cria/muda/apaga
alter table public.itens enable row level security;
drop policy if exists "itens ler"   on public.itens;
drop policy if exists "itens criar" on public.itens;
drop policy if exists "itens mudar" on public.itens;
drop policy if exists "itens apagar" on public.itens;
create policy "itens ler"    on public.itens for select using (publicado or public.eh_admin());
create policy "itens criar"  on public.itens for insert to authenticated with check (public.eh_admin());
create policy "itens mudar"  on public.itens for update to authenticated using (public.eh_admin()) with check (public.eh_admin());
create policy "itens apagar" on public.itens for delete to authenticated using (public.eh_admin());
grant select on public.itens to anon, authenticated;
grant insert, update, delete on public.itens to authenticated;

-- 4) data da última mudança
create or replace function public.itens_atualizado() returns trigger language plpgsql as $$
begin new.atualizado_em = now(); return new; end $$;
drop trigger if exists itens_atualizado on public.itens;
create trigger itens_atualizado before update on public.itens for each row execute function public.itens_atualizado();

-- 5) avisa a API do Supabase que existe tabela nova
notify pgrst, 'reload schema';
