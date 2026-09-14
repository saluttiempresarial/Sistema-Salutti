-- 010_rls_historico_acoes_por_carteira.sql
--
-- Corrige falha de segurança: a política historico_acoes_all usava só
-- is_funcionario_ativo() (só verifica "essa pessoa é funcionário ativo?",
-- sem checar carteira/cliente/licitação nenhum — ver definição da função).
-- Isso permitia que qualquer funcionário ativo, mesmo com carteira
-- limitada, visse o histórico de AÇÕES de TODOS os clientes e licitações
-- do sistema, quebrando a regra de "permissões granulares por carteira"
-- já aplicada em outras telas.
--
-- Correção: a regra agora depende do entidade_tipo de cada registro —
-- 'licitacao' respeita a carteira (via funcionario_acessa_licitacao, que
-- já embute admin), 'funcionario' fica restrito a Admin (histórico de
-- conta de colega é sensível, tipo RH). Qualquer entidade_tipo futuro que
-- ainda não exista hoje cai no caso padrão (só Admin), em vez de aberto.

drop policy if exists "historico_acoes_all" on historico_acoes;

create policy "historico_acoes_all"
on historico_acoes
for all
to authenticated
using (
  case entidade_tipo
    when 'licitacao' then funcionario_acessa_licitacao(entidade_id)
    when 'funcionario' then is_admin_ativo()
    else is_admin_ativo()
  end
)
with check (
  case entidade_tipo
    when 'licitacao' then funcionario_acessa_licitacao(entidade_id)
    when 'funcionario' then is_admin_ativo()
    else is_admin_ativo()
  end
);
