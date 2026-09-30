-- supabase/026_grant_authenticated_disputa_itens.sql
--
-- Corrige o erro "permission denied for table disputa_itens".
--
-- A tabela disputa_itens foi criada na migração 021 só por SQL, com RLS
-- habilitado e a policy certa (disputa_itens_all, baseada em
-- funcionario_acessa_licitacao) — mas sem o GRANT de tabela pro role
-- authenticated. No Postgres, permissão de tabela (GRANT) e RLS são duas
-- checagens separadas e em sequência: sem o GRANT, o banco barra a
-- consulta antes mesmo de chegar a avaliar a policy de RLS — não importa
-- se o usuário é Admin, Analista ou Cliente.
--
-- As demais tabelas do sistema (disputas, licitacoes, itens_licitacao
-- etc.) foram criadas pela interface do Supabase, que concede esse grant
-- sozinha — só disputa_itens, criada direto por migração SQL, ficou sem
-- ele. Mesmo padrão de grant explícito já usado na migração 014 (lá pro
-- service_role; aqui pro authenticated, que é o role usado pelo app
-- depois do login).

grant select, insert, update, delete on table public.disputa_itens to authenticated;
