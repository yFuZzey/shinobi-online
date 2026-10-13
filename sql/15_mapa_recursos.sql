-- =====================================================================
-- Shinobi Online · recursos do editor de mapas guardados no Storage do Supabase (arquivos originais, sem recompressão)
-- + tilesets e camadas de tiles. Rode no SQL Editor (pode rodar de novo). Precisa dos SQLs 09, 11 e 12.
-- Segurança: o bucket é de LEITURA pública só para o jogo baixar a arte (nada de listagem); só admin envia, troca ou apaga.
-- =====================================================================

-- 1) bucket (arquivos até 20 MB; só imagens)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mapa-recursos', 'mapa-recursos', true, 20971520, array['image/png','image/webp','image/jpeg','image/gif'])
on conflict (id) do update set public = true, file_size_limit = 20971520, allowed_mime_types = array['image/png','image/webp','image/jpeg','image/gif'];

drop policy if exists "mapa-recursos enviar"  on storage.objects;
drop policy if exists "mapa-recursos trocar"  on storage.objects;
drop policy if exists "mapa-recursos apagar"  on storage.objects;
create policy "mapa-recursos enviar" on storage.objects for insert to authenticated with check (bucket_id = 'mapa-recursos' and public.eh_admin());
create policy "mapa-recursos trocar" on storage.objects for update to authenticated using (bucket_id = 'mapa-recursos' and public.eh_admin()) with check (bucket_id = 'mapa-recursos' and public.eh_admin());
create policy "mapa-recursos apagar" on storage.objects for delete to authenticated using (bucket_id = 'mapa-recursos' and public.eh_admin());

-- 2) tilesets (a imagem original fica no Storage; aqui só os dados da grade)
create table if not exists public.mapa_tilesets (
  id        text primary key check (id ~ '^t_[a-z0-9_]{2,28}$'),
  nome      text not null check (char_length(btrim(nome)) between 1 and 40),
  arquivo   text not null check (arquivo ~ '^tilesets/[a-f0-9]{12}\.(png|webp|jpg|gif)$'),
  w         int  not null check (w between 1 and 8192),
  h         int  not null check (h between 1 and 8192),
  tw        int  not null check (tw between 4 and 512),
  th        int  not null check (th between 4 and 512),
  mg        int  not null default 0 check (mg between 0 and 256),
  sp        int  not null default 0 check (sp between 0 and 64),
  px        boolean not null default true,
  criado_em timestamptz not null default now()
);
alter table public.mapa_tilesets enable row level security;
drop policy if exists "mapa_tilesets ler"    on public.mapa_tilesets;
drop policy if exists "mapa_tilesets criar"  on public.mapa_tilesets;
drop policy if exists "mapa_tilesets mudar"  on public.mapa_tilesets;
drop policy if exists "mapa_tilesets apagar" on public.mapa_tilesets;
create policy "mapa_tilesets ler"    on public.mapa_tilesets for select using (true);
create policy "mapa_tilesets criar"  on public.mapa_tilesets for insert to authenticated with check (public.eh_admin());
create policy "mapa_tilesets mudar"  on public.mapa_tilesets for update to authenticated using (public.eh_admin()) with check (public.eh_admin());
create policy "mapa_tilesets apagar" on public.mapa_tilesets for delete to authenticated using (public.eh_admin());
grant select on public.mapa_tilesets to anon, authenticated;
grant insert, update, delete on public.mapa_tilesets to authenticated;

-- 3) imagens de objetos: o arquivo (PNG sem perda, já sem fundo) e o ORIGINAL enviado ficam no Storage
alter table public.mapa_imagens add column if not exists arquivo  text check (arquivo is null or arquivo ~ '^objetos/[a-f0-9]{12}\.png$');
alter table public.mapa_imagens add column if not exists original text check (original is null or original ~ '^originais/[a-f0-9]{12}\.(png|webp|jpg|gif)$');
alter table public.mapa_imagens alter column png drop not null;
alter table public.mapa_imagens drop constraint if exists mapa_imagens_png_check;
alter table public.mapa_imagens add constraint mapa_imagens_png_check check (png is null or (png ~ '^data:image/(png|webp);base64,' and char_length(png) <= 1500000));
alter table public.mapa_imagens drop constraint if exists mapa_imagens_fonte_check;
alter table public.mapa_imagens add constraint mapa_imagens_fonte_check check (png is not null or arquivo is not null);
alter table public.mapa_imagens drop constraint if exists mapa_imagens_w_check;
alter table public.mapa_imagens drop constraint if exists mapa_imagens_h_check;
alter table public.mapa_imagens add constraint mapa_imagens_w_check check (w between 1 and 8192);
alter table public.mapa_imagens add constraint mapa_imagens_h_check check (h between 1 and 8192);
alter table public.mapa_imagens drop constraint if exists mapa_imagens_dw_check;
alter table public.mapa_imagens drop constraint if exists mapa_imagens_dh_check;
alter table public.mapa_imagens add constraint mapa_imagens_dw_check check (dw is null or dw between 1 and 8192);
alter table public.mapa_imagens add constraint mapa_imagens_dh_check check (dh is null or dh between 1 and 8192);

notify pgrst, 'reload schema';
