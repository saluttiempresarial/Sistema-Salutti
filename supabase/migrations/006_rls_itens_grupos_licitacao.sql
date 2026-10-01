-- 006_rls_itens_grupos_licitacao.sql
--
-- Corrige o Portal do Cliente não conseguir ver os itens/grupos de uma
-- licitação (RLS bloqueava silenciosamente, sem erro visível). Cria uma
-- política de SELECT para `itens_licitacao` e `grupos_itens_licitacao`
-- reaproveitando a MESMA regra já usada em `licitacoes` — se a pessoa
-- pode ver a licitação (via a policy licitacoes_select), também pode ver
-- os itens/grupos dela.

-- Confirma que RLS está ativo nas duas tabelas (não desativa nada que já
-- estava ativo; se já estiver ativo, este comando não tem efeito).
alter table itens_licitacao enable row level security;
alter table grupos_itens_licitacao enable row level security;

create policy "itens_licitacao_select"
on itens_licitacao
for select
to authenticated
using (
  exists (
    select 1 from licitacoes l
    where l.id = itens_licitacao.licitacao_id
  )
);

create policy "grupos_itens_licitacao_select"
on grupos_itens_licitacao
for select
to authenticated
using (
  exists (
    select 1 from licitacoes l
    where l.id = grupos_itens_licitacao.licitacao_id
  )
);
