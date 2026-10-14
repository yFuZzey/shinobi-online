-- =====================================================================
-- Shinobi Online · MISSÕES (editor novo /painel/editor + NPCs)
--   missoes            = as missões criadas no editor (nome e os passos que aparecem no diário do jogador). Só admin lê e grava.
--   missao_progresso   = em que passo cada personagem está em cada missão (0 = não começou, 1..N = passo, 999 = concluída).
--                        Só o servidor do jogo grava (chave secreta); ninguém lê nem grava pelo app.
-- Rode no SQL Editor (pode rodar de novo). Precisa do SQL 09 (eh_admin).
-- =====================================================================
create table if not exists public.missoes (
  id            text primary key check (id ~ '^q_[a-z0-9_]{2,40}$'),
  nome          text not null check (char_length(btrim(nome)) between 1 and 60),
  passos        jsonb not null default '[]'::jsonb check (jsonb_typeof(passos) = 'array' and jsonb_array_length(passos) <= 30 and pg_column_size(passos) <= 20000),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table public.missoes enable row level security;
drop policy if exists "missoes ler"    on public.missoes;
drop policy if exists "missoes criar"  on public.missoes;
drop policy if exists "missoes mudar"  on public.missoes;
drop policy if exists "missoes apagar" on public.missoes;
create policy "missoes ler"    on public.missoes for select to authenticated using (public.eh_admin());
create policy "missoes criar"  on public.missoes for insert to authenticated with check (public.eh_admin());
create policy "missoes mudar"  on public.missoes for update to authenticated using (public.eh_admin()) with check (public.eh_admin());
create policy "missoes apagar" on public.missoes for delete to authenticated using (public.eh_admin());
revoke all on public.missoes from anon;
grant select, insert, update, delete on public.missoes to authenticated;
create or replace function public.missoes_atualizado() returns trigger language plpgsql as $$
begin new.atualizado_em = now(); return new; end $$;
drop trigger if exists missoes_atualizado on public.missoes;
create trigger missoes_atualizado before update on public.missoes for each row execute function public.missoes_atualizado();

create table if not exists public.missao_progresso (
  personagem_id uuid not null,
  missao        text not null check (missao ~ '^q_[a-z0-9_]{2,40}$'),
  passo         int  not null default 0 check (passo between 0 and 999),
  atualizado_em timestamptz not null default now(),
  primary key (personagem_id, missao)
);
alter table public.missao_progresso enable row level security;
revoke all on public.missao_progresso from anon, authenticated; -- só o servidor (chave secreta) mexe

notify pgrst, 'reload schema';
