-- =====================================================================
-- Shinobi Online · BIBLIOTECA DE RECURSOS do editor novo (/painel/editor)
-- Um registro por imagem importada (tileset, spritesheet ou imagem solta). O arquivo ORIGINAL fica no Storage sem alteração;
-- "arquivo" é o que o editor/jogo usam (o próprio original ou uma cópia PNG sem o fundo). Grade, recortes e fundo são só metadados.
-- Rode no SQL Editor (pode rodar de novo). Precisa dos SQLs 09 (eh_admin) e 15 (Storage mapa-recursos).
-- Segurança: só admin lê e grava (o servidor do jogo lê com a chave secreta, quando as próximas fases usarem).
-- =====================================================================
create table if not exists public.mapa_recursos (
  id            text primary key check (id ~ '^r_[a-z0-9_]{2,40}$'),
  nome          text not null check (char_length(btrim(nome)) between 1 and 60),
  tipo          text not null default 'spritesheet' check (tipo in ('tileset', 'spritesheet', 'imagem')),
  categoria     text not null default '' check (char_length(categoria) <= 40),
  colecao       text not null default '' check (char_length(colecao) <= 40),
  original      text not null check (original ~ '^(originais|tilesets|objetos)/[a-f0-9]{12}\.(png|webp|jpg|gif)$'),
  arquivo       text not null check (arquivo ~ '^(originais|derivados|tilesets|objetos)/[a-f0-9]{12}\.(png|webp|jpg|gif)$'),
  w             int  not null check (w between 1 and 16384),
  h             int  not null check (h between 1 and 16384),
  fundo         jsonb,
  grade         jsonb,
  recortes      jsonb not null default '[]'::jsonb check (jsonb_typeof(recortes) = 'array' and jsonb_array_length(recortes) <= 2000),
  meta          jsonb not null default '{}'::jsonb,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table public.mapa_recursos enable row level security;
drop policy if exists "mapa_recursos ler"    on public.mapa_recursos;
drop policy if exists "mapa_recursos criar"  on public.mapa_recursos;
drop policy if exists "mapa_recursos mudar"  on public.mapa_recursos;
drop policy if exists "mapa_recursos apagar" on public.mapa_recursos;
create policy "mapa_recursos ler"    on public.mapa_recursos for select to authenticated using (public.eh_admin());
create policy "mapa_recursos criar"  on public.mapa_recursos for insert to authenticated with check (public.eh_admin());
create policy "mapa_recursos mudar"  on public.mapa_recursos for update to authenticated using (public.eh_admin()) with check (public.eh_admin());
create policy "mapa_recursos apagar" on public.mapa_recursos for delete to authenticated using (public.eh_admin());
revoke all on public.mapa_recursos from anon;
grant select, insert, update, delete on public.mapa_recursos to authenticated;

create or replace function public.mapa_recursos_atualizado() returns trigger language plpgsql as $$
begin new.atualizado_em = now(); return new; end $$;
drop trigger if exists mapa_recursos_atualizado on public.mapa_recursos;
create trigger mapa_recursos_atualizado before update on public.mapa_recursos for each row execute function public.mapa_recursos_atualizado();

notify pgrst, 'reload schema';
