-- supabase/migrations/041_troca_senha_obrigatoria_cliente.sql
--
-- Troca obrigatória de senha no primeiro acesso dos USUÁRIOS DE CLIENTE
-- (Responsável e Operador). Para funcionários isso já existe: o Administrador
-- define uma senha temporária, a pessoa é levada à tela /trocar-senha ao
-- entrar e, depois de trocar, a marca `forcar_troca_senha` é zerada pela
-- função desativar_troca_senha_obrigatoria().
--
-- Para os usuários de cliente, a tabela usuarios_cliente só permite UPDATE ao
-- Administrador e ao Analista. Por isso o próprio usuário não consegue zerar a
-- marca com um update direto. Esta migração cria uma função SECURITY DEFINER
-- que zera a marca SOMENTE da linha do usuário logado (auth.uid()), igual ao
-- que a migração 028 faz para a foto de perfil.
--
-- A função não recebe parâmetros: não há como zerar a marca de outra pessoa.
--
-- A coluna forcar_troca_senha já é usada pelo sistema; o "add column if not
-- exists" abaixo só garante que ela exista, sem alterar o que já há.
--
-- Para desfazer:
--   drop function if exists public.desativar_troca_senha_obrigatoria_cliente();

alter table public.usuarios_cliente
  add column if not exists forcar_troca_senha boolean not null default false;

create or replace function public.desativar_troca_senha_obrigatoria_cliente()
returns void
language sql
security definer
set search_path = public
as $$
  update usuarios_cliente
     set forcar_troca_senha = false
   where auth_user_id = auth.uid();
$$;

revoke all on function public.desativar_troca_senha_obrigatoria_cliente() from public, anon;
grant execute on function public.desativar_troca_senha_obrigatoria_cliente() to authenticated;
