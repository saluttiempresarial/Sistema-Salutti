-- supabase/migrations/047_licitacoes_select_analista_insert.sql
--
-- Problema (15/10): o Analista, mesmo com o cliente na sua carteira, não
-- conseguia cadastrar licitação. Erro: "new row violates row-level security
-- policy for table licitacoes".
--
-- Causa: o sistema grava a licitação e lê a linha de volta na mesma chamada
-- (insert ... returning). Para devolver a linha, o banco também confere a
-- regra de SELECT (licitacoes_select). Essa regra usava
-- funcionario_acessa_licitacao(id), que CONSULTA a tabela licitacoes para
-- descobrir o cliente. Dentro da própria chamada de INSERT, a função ainda
-- não enxerga a linha nova e devolve falso. O Administrador não sofre isso
-- porque is_admin_ativo() libera antes de qualquer consulta.
--
-- Correção: acrescentar à regra de SELECT a condição
-- funcionario_acessa_cliente(cliente_id), que olha a coluna da própria linha
-- e não consulta a tabela.
--
-- Não amplia acesso: funcionario_acessa_cliente libera Administrador ativo,
-- funcionário com acesso total ou funcionário com o cliente vinculado. Todos
-- esses casos já eram liberados por funcionario_acessa_licitacao (que ainda
-- soma as licitações atribuídas individualmente, mantidas como estavam).
--
-- Regras de INSERT, UPDATE e DELETE: não mudam.
--
-- Para desfazer: execute de novo o bloco abaixo sem a linha
-- "or funcionario_acessa_cliente(cliente_id)".

drop policy if exists "licitacoes_select" on licitacoes;

create policy "licitacoes_select"
on licitacoes
for select
to authenticated
using (
  is_admin_ativo()
  or funcionario_acessa_licitacao(id)
  or funcionario_acessa_cliente(cliente_id)
  or cliente_acessa(cliente_id)
);

-- Conferência (deve listar as 4 regras, e a de SELECT com as 4 condições):
-- select policyname, cmd, qual, with_check
-- from pg_policies
-- where tablename = 'licitacoes'
-- order by cmd, policyname;
