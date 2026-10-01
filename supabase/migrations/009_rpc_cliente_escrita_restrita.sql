-- 009_rpc_cliente_escrita_restrita.sql
--
-- Fecha uma limitação de segurança conhecida: o RLS do Postgres restringe
-- QUAIS LINHAS uma política libera, mas não QUAIS COLUNAS. As políticas
-- adicionadas hoje (itens_licitacao_cliente_update, licitacoes_update com
-- cliente_acessa, historico_acoes_cliente_licitacao) davam ao Cliente
-- permissão de UPDATE na linha inteira — na tela isso não é um problema
-- (o código só manda os campos certos), mas por uma chamada direta à API
-- o Cliente poderia, em teoria, alterar campos que só o Analista/Admin
-- deveriam mexer (Descrição, Valor de Referência, Órgão, etc.).
--
-- A correção: duas funções SECURITY DEFINER que só aceitam exatamente os
-- campos da Proposta Comercial / decisão do cliente como parâmetros —
-- não é possível pedir pra elas alterarem nenhum outro campo, porque elas
-- nem recebem esses outros campos como entrada. Depois de criar essas
-- funções, as políticas de UPDATE amplas de hoje são revertidas.

-- 1) Proposta Comercial (Cód. Produto, Descrição, Fabricante, Modelo,
--    Preço Mínimo) — só os campos proposta_* de um item, nunca os campos
--    de referência (descricao, quantidade, preco_referencia, etc.).
create or replace function public.atualizar_proposta_item_cliente(
  p_item_id uuid,
  p_codigo_interno text,
  p_descricao_produto text,
  p_marca text,
  p_modelo text,
  p_preco_minimo numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_licitacao_id uuid;
begin
  select licitacao_id into v_licitacao_id
  from itens_licitacao
  where id = p_item_id;

  if v_licitacao_id is null then
    raise exception 'Item não encontrado';
  end if;

  if not exists (
    select 1 from licitacoes l
    where l.id = v_licitacao_id
    and (is_admin_ativo() or cliente_acessa(l.cliente_id))
  ) then
    raise exception 'Sem permissão para editar a proposta deste item';
  end if;

  update itens_licitacao
  set
    proposta_codigo_interno = p_codigo_interno,
    proposta_descricao = p_descricao_produto,
    proposta_marca = p_marca,
    proposta_modelo = p_modelo,
    proposta_preco_minimo = p_preco_minimo
  where id = p_item_id;
end;
$$;

-- 2) Decisão do cliente (participar/recusar + frete) — só esses campos na
--    licitação, e já grava o histórico junto (por isso o Cliente não
--    precisa mais de nenhuma permissão direta em historico_acoes).
create or replace function public.registrar_decisao_cliente(
  p_licitacao_id uuid,
  p_decisao text,
  p_usuario text,
  p_motivo_recusa text,
  p_cobrar_frete boolean,
  p_percentual_frete numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_descricao text;
begin
  if not exists (
    select 1 from licitacoes l
    where l.id = p_licitacao_id
    and (is_admin_ativo() or cliente_acessa(l.cliente_id))
  ) then
    raise exception 'Sem permissão para registrar decisão nesta licitação';
  end if;

  if p_decisao not in ('participar', 'recusar') then
    raise exception 'Decisão inválida: %', p_decisao;
  end if;

  update licitacoes
  set
    decisao_cliente = p_decisao,
    decisao_cliente_em = now(),
    motivo_recusa_cliente = case when p_decisao = 'recusar' then p_motivo_recusa else null end,
    cobrar_frete = p_cobrar_frete,
    percentual_frete = case when p_cobrar_frete then p_percentual_frete else null end
  where id = p_licitacao_id;

  v_descricao := case
    when p_decisao = 'participar' then 'Cliente confirmou participação nesta licitação'
    else 'Cliente recusou participar' || coalesce(' — motivo: ' || p_motivo_recusa, '')
  end;

  insert into historico_acoes (entidade_tipo, entidade_id, descricao, usuario)
  values ('licitacao', p_licitacao_id, v_descricao, p_usuario);
end;
$$;

-- 3) Reverte as permissões amplas de hoje — o Cliente não precisa mais de
--    UPDATE direto nessas tabelas, só das funções acima.
drop policy if exists "itens_licitacao_cliente_update" on itens_licitacao;

drop policy if exists "licitacoes_update" on licitacoes;
create policy "licitacoes_update"
on licitacoes
for update
to authenticated
using (is_admin_ativo() or funcionario_acessa_licitacao(id))
with check (is_admin_ativo() or funcionario_acessa_licitacao(id));

drop policy if exists "historico_acoes_cliente_licitacao" on historico_acoes;
