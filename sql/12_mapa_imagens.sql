-- Shinobi Online · imagens próprias para o editor de mapas (PNG importado, sem fundo)
-- Rode no SQL Editor do Supabase (pode rodar de novo). Precisa do SQL 09 (eh_admin) e do SQL 11 (mapas).
create table if not exists public.mapa_imagens (
  id        text primary key check (id ~ '^c_[a-z0-9_]{2,28}$'),
  nome      text not null check (char_length(btrim(nome)) between 1 and 24),
  png       text not null check (png ~ '^data:image/(png|webp);base64,' and char_length(png) <= 1500000),
  w         int  not null check (w between 1 and 1024),
  h         int  not null check (h between 1 and 1024),
  fw        int  not null default 1 check (fw between 1 and 8),
  fh        int  not null default 1 check (fh between 1 and 8),
  off       int  not null default 0 check (off between 0 and 8),
  ns        boolean not null default false,
  criado_em timestamptz not null default now()
);
alter table public.mapa_imagens enable row level security;
drop policy if exists "mapa_imagens ler"    on public.mapa_imagens;
drop policy if exists "mapa_imagens criar"  on public.mapa_imagens;
drop policy if exists "mapa_imagens mudar"  on public.mapa_imagens;
drop policy if exists "mapa_imagens apagar" on public.mapa_imagens;
create policy "mapa_imagens ler"    on public.mapa_imagens for select using (true);
create policy "mapa_imagens criar"  on public.mapa_imagens for insert to authenticated with check (public.eh_admin());
create policy "mapa_imagens mudar"  on public.mapa_imagens for update to authenticated using (public.eh_admin()) with check (public.eh_admin());
create policy "mapa_imagens apagar" on public.mapa_imagens for delete to authenticated using (public.eh_admin());
grant select on public.mapa_imagens to anon, authenticated;
grant insert, update, delete on public.mapa_imagens to authenticated;
notify pgrst, 'reload schema';
