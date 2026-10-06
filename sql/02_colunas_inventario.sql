-- =====================================================================
-- Shinobi Online · personagem em colunas + tabela de inventário
-- Rode UMA vez no SQL Editor do Supabase (pode rodar de novo sem estragar).
-- =====================================================================

-- 0) cópia de segurança do jeito antigo (só na primeira vez)
create table if not exists public.personagens_backup_v1 as select * from public.personagens;
alter table public.personagens_backup_v1 enable row level security;
revoke all on public.personagens_backup_v1 from anon, authenticated;

-- 1) colunas novas (uma informação por coluna)
alter table public.personagens
  add column if not exists admin        boolean not null default false,
  add column if not exists cla          text,
  add column if not exists nivel        int     not null default 1,
  add column if not exists xp           int     not null default 0,
  add column if not exists pontos       int     not null default 0,
  add column if not exists forca        int     not null default 0,
  add column if not exists agilidade    int     not null default 0,
  add column if not exists vitalidade   int     not null default 0,
  add column if not exists inteligencia int     not null default 0,
  add column if not exists destreza     int     not null default 0,
  add column if not exists sorte        int     not null default 0,
  add column if not exists mapa         text,
  add column if not exists pele         text,
  add column if not exists cabelo       text,
  add column if not exists roupa        text;

-- 2) tabela de inventário: uma linha por item
create table if not exists public.inventario (
  id            bigint generated always as identity primary key,
  personagem_id uuid not null references public.personagens(id) on delete cascade,
  item          text not null,
  equipado      boolean not null default false,
  criado        timestamptz not null default now()
);
create index if not exists inventario_personagem on public.inventario (personagem_id);

-- 3) copia o que estava guardado na coluna "dados" (só de quem ainda não foi copiado)
update public.personagens set
  cla          = coalesce(dados->>'clan', cla),
  nivel        = coalesce((dados->'ch'->>'lv')::int, nivel),
  xp           = coalesce((dados->'ch'->>'xp')::int, xp),
  pontos       = coalesce((dados->'ch'->>'pts')::int, pontos),
  forca        = coalesce((dados->'ch'->'st'->>'str')::int, forca),
  agilidade    = coalesce((dados->'ch'->'st'->>'agi')::int, agilidade),
  vitalidade   = coalesce((dados->'ch'->'st'->>'vit')::int, vitalidade),
  inteligencia = coalesce((dados->'ch'->'st'->>'int')::int, inteligencia),
  destreza     = coalesce((dados->'ch'->'st'->>'dex')::int, destreza),
  sorte        = coalesce((dados->'ch'->'st'->>'luk')::int, sorte),
  mapa         = coalesce(dados->>'mapa', mapa),
  pele         = coalesce(dados->'look'->>'skin', pele),
  cabelo       = coalesce(dados->'look'->>'hair', cabelo),
  roupa        = coalesce(dados->'look'->>'cloth', roupa)
where dados ? 'clan';

insert into public.inventario (personagem_id, item, equipado)
  select p.id, x.value, false from public.personagens p, jsonb_array_elements_text(coalesce(p.dados->'inv'->'inv','[]'::jsonb)) x where p.dados ? 'clan';
insert into public.inventario (personagem_id, item, equipado)
  select p.id, x.value, true from public.personagens p, jsonb_each_text(coalesce(p.dados->'inv'->'eq','{}'::jsonb)) x where p.dados ? 'clan';

update public.personagens set dados = '{}'::jsonb where dados ? 'clan';

-- 4) segurança: cada jogador só mexe no que é dele; "admin" só muda pelo painel/SQL
alter table public.inventario enable row level security;
drop policy if exists "inv ler o proprio"   on public.inventario;
drop policy if exists "inv criar o proprio" on public.inventario;
drop policy if exists "inv mudar o proprio" on public.inventario;
drop policy if exists "inv apagar o proprio" on public.inventario;
create policy "inv ler o proprio"    on public.inventario for select using (auth.uid() = personagem_id);
create policy "inv criar o proprio"  on public.inventario for insert with check (auth.uid() = personagem_id);
create policy "inv mudar o proprio"  on public.inventario for update using (auth.uid() = personagem_id) with check (auth.uid() = personagem_id);
create policy "inv apagar o proprio" on public.inventario for delete using (auth.uid() = personagem_id);
revoke all on public.inventario from anon;
grant select, insert, update (item, equipado), delete on public.inventario to authenticated;

revoke insert, update on public.personagens from anon, authenticated;
grant insert (id, nome, dados, atualizado, cla, nivel, xp, pontos, forca, agilidade, vitalidade, inteligencia, destreza, sorte, mapa, pele, cabelo, roupa) on public.personagens to authenticated;
grant update (dados, atualizado, cla, nivel, xp, pontos, forca, agilidade, vitalidade, inteligencia, destreza, sorte, mapa, pele, cabelo, roupa) on public.personagens to authenticated;

-- 5) salvar o inventário inteiro de uma vez (tudo ou nada)
create or replace function public.salvar_inventario(itens jsonb)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sem login'; end if;
  delete from public.inventario where personagem_id = auth.uid();
  insert into public.inventario (personagem_id, item, equipado)
    select auth.uid(), left(x->>'item', 40), coalesce((x->>'equipado')::boolean, false)
    from jsonb_array_elements(coalesce(itens, '[]'::jsonb)) x
    where coalesce(x->>'item', '') <> '';
end $$;
revoke all on function public.salvar_inventario(jsonb) from public, anon;
grant execute on function public.salvar_inventario(jsonb) to authenticated;
