-- 014_grant_service_role_funcionarios_usuarios_cliente.sql
--
-- Documentação (já aplicada, não precisa rodar de novo): a Edge Function
-- gerenciar-login-usuario usa a service_role key pra vincular o
-- auth_user_id de volta em funcionarios/usuarios_cliente depois de criar
-- o login — mas essas tabelas, criadas por SQL direto (não pela interface
-- do Supabase), nunca tinham recebido a concessão básica de acesso pro
-- papel service_role. Sem isso, mesmo a service_role (que ignora RLS)
-- levava "permission denied" — RLS e GRANT são camadas diferentes de
-- permissão no Postgres.

grant select, insert, update, delete on table funcionarios to service_role;
grant select, insert, update, delete on table usuarios_cliente to service_role;
