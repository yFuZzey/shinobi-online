-- =====================================================================
-- Shinobi Online · banimento (/ban e /unban no chat, só admins)
-- Rode no SQL Editor do Supabase (pode rodar de novo sem estragar).
-- =====================================================================

-- 1) lista de banidos: um por personagem; "ate" vazio = para sempre
create table if not exists public.banidos (
  personagem_id uuid primary key references public.personagens(id) on delete cascade,
  ate           timestamptz,
  motivo        text,
  por           text,
  quando        timestamptz not null default now()
);

-- 2) só o servidor do jogo (chave secreta) lê e grava; jogadores não veem nem mexem
alter table public.banidos enable row level security;
revoke all on public.banidos from anon, authenticated;
grant all on public.banidos to service_role;

-- 3) avisa a API do Supabase
notify pgrst, 'reload schema';
