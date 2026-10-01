-- 017_prazo_edicao_proposta_cliente.sql
--
-- Reforça no banco a mesma regra já aplicada na tela: o Cliente só pode
-- confirmar participação (primeira vez ou reenvio de uma proposta já
-- enviada antes) até 3 dias antes da data da sessão da licitação
-- (data_efetiva_licitacao, quando existir, senão data_licitacao). Sem
-- isso, a trava seria só de aparência — bastaria uma chamada direta à
-- API pra contornar a tela.
--
-- Não afeta o Admin, que continua podendo editar a qualquer momento (a
-- regra de prazo é só pra participação do Cliente).

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
  v_exclusivo_me_epp boolean;
  v_cliente_id uuid;
  v_porte_cliente text;
  v_data_sessao timestamptz;
begin
  select licitacao_id, exclusivo_me_epp into v_licitacao_id, v_exclusivo_me_epp
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

  -- Prazo de 3 dias antes da sessão — só vale pro Cliente, não pro Admin.
  if not is_admin_ativo() then
    select coalesce(data_efetiva_licitacao, data_licitacao) into v_data_sessao
    from licitacoes where id = v_licitacao_id;

    if now() > (v_data_sessao - interval '3 days') then
      raise exception 'O prazo para editar a proposta já encerrou (até 3 dias antes da sessão)';
    end if;
  end if;

  -- Bloqueio ME/EPP: só se aplica quando quem está chamando é o próprio
  -- Cliente (não bloqueia o Admin editando em nome de ninguém).
  if not is_admin_ativo() and v_exclusivo_me_epp then
    select l.cliente_id into v_cliente_id from licitacoes l where l.id = v_licitacao_id;
    select porte into v_porte_cliente from clientes where id = v_cliente_id;

    if v_porte_cliente is distinct from 'me_epp' then
      raise exception 'Este item é exclusivo para participação de empresas ME/EPP';
    end if;
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
  v_data_sessao timestamptz;
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

  -- Prazo de 3 dias antes da sessão — vale pra qualquer confirmação de
  -- participação do Cliente (primeira vez ou reenvio de uma já
  -- confirmada antes). Não se aplica à recusa nem ao Admin.
  if not is_admin_ativo() and p_decisao = 'participar' then
    select coalesce(data_efetiva_licitacao, data_licitacao) into v_data_sessao
    from licitacoes where id = p_licitacao_id;

    if now() > (v_data_sessao - interval '3 days') then
      raise exception 'O prazo para participar desta licitação já encerrou (até 3 dias antes da sessão)';
    end if;
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
