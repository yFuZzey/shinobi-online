-- TAG admin (rodar uma vez no SQL Editor do Supabase)
alter table public.personagens add column if not exists admin boolean not null default false;
-- o app só pode gravar nome/dados; a coluna admin só muda pelo painel do Supabase
revoke insert, update on public.personagens from anon, authenticated;
grant insert (id, nome, dados, atualizado) on public.personagens to authenticated;
grant update (nome, dados, atualizado) on public.personagens to authenticated;
-- para dar admin a alguém (troque SeuNome):
-- update public.personagens set admin = true where lower(nome) = lower('SeuNome');
