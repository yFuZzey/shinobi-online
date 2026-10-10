-- =====================================================================
-- Shinobi Online · mapas criados no editor do painel (/painel/mapas no servidor do jogo)
-- Rode no SQL Editor do Supabase (pode rodar de novo sem estragar).
-- Precisa do SQL 09 antes (usa a função eh_admin). Sem isto o jogo funciona normalmente com os mapas que já tem.
-- =====================================================================

create table if not exists public.mapas (
  id            text primary key check (id ~ '^[a-z0-9_]{2,30}$'),
  nome          text not null check (char_length(btrim(nome)) between 2 and 40),
  mapa          jsonb not null,
  publicado     boolean not null default false,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- todo mundo lê os publicados; só admin vê rascunhos e cria/muda/apaga
alter table public.mapas enable row level security;
drop policy if exists "mapas ler"    on public.mapas;
drop policy if exists "mapas criar"  on public.mapas;
drop policy if exists "mapas mudar"  on public.mapas;
drop policy if exists "mapas apagar" on public.mapas;
create policy "mapas ler"    on public.mapas for select using (publicado or public.eh_admin());
create policy "mapas criar"  on public.mapas for insert to authenticated with check (public.eh_admin());
create policy "mapas mudar"  on public.mapas for update to authenticated using (public.eh_admin()) with check (public.eh_admin());
create policy "mapas apagar" on public.mapas for delete to authenticated using (public.eh_admin());
grant select on public.mapas to anon, authenticated;
grant insert, update, delete on public.mapas to authenticated;

create or replace function public.mapas_atualizado() returns trigger language plpgsql as $$
begin new.atualizado_em = now(); return new; end $$;
drop trigger if exists mapas_atualizado on public.mapas;
create trigger mapas_atualizado before update on public.mapas for each row execute function public.mapas_atualizado();

notify pgrst, 'reload schema';
