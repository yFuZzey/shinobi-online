-- =====================================================================
-- Shinobi Online · CONJUNTOS DE TILES do editor novo (/painel/editor): pedaços de mapa salvos para reaproveitar
-- (estrada, casa, cerca...). "dados" guarda terreno, colisão e tiles por camada, com o tileset de cada tile.
-- Rode no SQL Editor (pode rodar de novo). Precisa do SQL 09 (eh_admin). Só admin lê e grava.
-- =====================================================================
create table if not exists public.mapa_conjuntos (
  id            text primary key check (id ~ '^k_[a-z0-9_]{2,40}$'),
  nome          text not null check (char_length(btrim(nome)) between 1 and 60),
  categoria     text not null default '' check (char_length(categoria) <= 40),
  w             int  not null check (w between 1 and 100),
  h             int  not null check (h between 1 and 100),
  dados         jsonb not null check (jsonb_typeof(dados) = 'object' and pg_column_size(dados) <= 500000),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table public.mapa_conjuntos enable row level security;
drop policy if exists "mapa_conjuntos ler"    on public.mapa_conjuntos;
drop policy if exists "mapa_conjuntos criar"  on public.mapa_conjuntos;
drop policy if exists "mapa_conjuntos mudar"  on public.mapa_conjuntos;
drop policy if exists "mapa_conjuntos apagar" on public.mapa_conjuntos;
create policy "mapa_conjuntos ler"    on public.mapa_conjuntos for select to authenticated using (public.eh_admin());
create policy "mapa_conjuntos criar"  on public.mapa_conjuntos for insert to authenticated with check (public.eh_admin());
create policy "mapa_conjuntos mudar"  on public.mapa_conjuntos for update to authenticated using (public.eh_admin()) with check (public.eh_admin());
create policy "mapa_conjuntos apagar" on public.mapa_conjuntos for delete to authenticated using (public.eh_admin());
revoke all on public.mapa_conjuntos from anon;
grant select, insert, update, delete on public.mapa_conjuntos to authenticated;
create or replace function public.mapa_conjuntos_atualizado() returns trigger language plpgsql as $$
begin new.atualizado_em = now(); return new; end $$;
drop trigger if exists mapa_conjuntos_atualizado on public.mapa_conjuntos;
create trigger mapa_conjuntos_atualizado before update on public.mapa_conjuntos for each row execute function public.mapa_conjuntos_atualizado();
notify pgrst, 'reload schema';
