-- 028_foto_propria_usuario_cliente.sql
--
-- Permite que o próprio usuário do Cliente (gestor/operador) tenha foto de
-- perfil individual, no mesmo padrão já existente para Funcionário (ver
-- 011_foto_propria_funcionario.sql).
--
-- O que faz:
--   1. Acrescenta a coluna foto_url em usuarios_cliente.
--   2. Cria a função atualizar_foto_propria_cliente(nova_url), que só deixa
--      a pessoa alterar o foto_url da PRÓPRIA linha (filtro por
--      auth_user_id = auth.uid()) — necessário porque a política de UPDATE
--      de usuarios_cliente é restrita a Admin/Funcionário; sem essa função
--      SECURITY DEFINER, o próprio cliente nunca conseguiria salvar a foto.
--
-- Premissa (a confirmar): assumindo que usuarios_cliente já tem a coluna
-- auth_user_id, do mesmo jeito que funcionarios tem — é o que o
-- loginUsuarioService usa para vincular o login criado na Edge Function
-- "gerenciar-login-usuario" à linha correspondente. Se o nome da coluna
-- for outro no seu banco, me avisa que ajusto a função abaixo.
--
-- ATENÇÃO — passo manual fora deste SQL: é preciso criar o bucket de
-- Storage "usuarios-cliente-fotos" (igual ao "funcionarios-fotos" já
-- existente), com a mesma política de acesso (cada usuário só grava na
-- própria pasta, identificada pelo auth_user_id). Como não tenho acesso
-- à configuração desse bucket já existente, não arrisco recriar a
-- política aqui "no escuro" — pode copiar a mesma política usada em
-- "funcionarios-fotos" para o bucket novo.

alter table public.usuarios_cliente
  add column if not exists foto_url text;

create or replace function public.atualizar_foto_propria_cliente(nova_url text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update usuarios_cliente
  set foto_url = nova_url
  where auth_user_id = auth.uid();
end;
$function$;
