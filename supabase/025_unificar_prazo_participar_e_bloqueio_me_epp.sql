-- supabase/025_unificar_prazo_participar_e_bloqueio_me_epp.sql
--
-- A pedido do Márcio (30/09), duas pendências resolvidas de uma vez porque
-- as duas mexem na mesma função (registrar_decisao_cliente):
--
-- 1. UNIFICA a regra de prazo do "Quero Participar" com a regra da Proposta
--    Comercial (seção 4.3.1 da Especificação Funcional v4.0). Antes, esta
--    função tinha sua PRÓPRIA regra, antiga e separada (3 dias corridos
--    fixos, sem liberação manual, sem trava absoluta, e sem reconhecer o
--    Analista). Isso nunca fazia sentido de verdade: na prática, o Cliente
--    sempre confirma participação e envia a Proposta Comercial juntos, na
--    mesma tela (PropostaComercialPage-cliente.tsx chama
--    registrarPropostaCliente + registrarDecisaoCliente em sequência),
--    então as duas travas precisam ser exatamente a mesma, senão uma trava
--    destrava e a outra não. Agora usa os mesmos 3 níveis de
--    atualizar_proposta_item_cliente (migração 024): prazo normal (4 dias
--    úteis, 18h30), liberação manual (prazo_proposta_liberado /
--    prazo_proposta_liberado_ate) e trava absoluta (1 dia útil, 18h30, sem
--    exceção — nem Admin, nem Analista). A trava só vale pra "participar";
--    "recusar" continua liberado a qualquer momento, como já era.
--
-- 2. BLOQUEIA DE VEZ clientes classificados como ME/EPP (porte da empresa)
--    de confirmar participação em qualquer licitação pelo sistema — regra
--    de negócio já registrada na especificação como decidida, mas nunca
--    implementada. Diferente do bloqueio por ITEM já existente (item
--    "Exclusivo ME/EPP" bloqueando empresa "Demais"): este é um bloqueio
--    pela EMPRESA inteira, em qualquer licitação, independentemente dos
--    itens. Vale mesmo se for o Admin ou o Analista tentando confirmar em
--    nome do cliente.
--
-- Depende de subtrair_dias_uteis() (migração 023) e do padrão
-- is_admin_ativo() / funcionario_acessa_licitacao() já usado nas demais
-- funções.

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
  v_cliente_id uuid;
  v_porte_cliente text;
  v_data_sessao timestamptz;
  v_limite_absoluto timestamptz;
  v_limite_normal timestamptz;
  v_prazo_liberado boolean;
  v_prazo_liberado_ate timestamptz;
  v_eh_staff boolean;
begin
  if not exists (
    select 1 from licitacoes l
    where l.id = p_licitacao_id
    and (is_admin_ativo() or funcionario_acessa_licitacao(p_licitacao_id) or cliente_acessa(l.cliente_id))
  ) then
    raise exception 'Sem permissão para registrar decisão nesta licitação';
  end if;

  if p_decisao not in ('participar', 'recusar') then
    raise exception 'Decisão inválida: %', p_decisao;
  end if;

  select cliente_id, coalesce(data_efetiva_licitacao, data_licitacao),
         prazo_proposta_liberado, prazo_proposta_liberado_ate
    into v_cliente_id, v_data_sessao, v_prazo_liberado, v_prazo_liberado_ate
  from licitacoes
  where id = p_licitacao_id;

  v_eh_staff := is_admin_ativo() or funcionario_acessa_licitacao(p_licitacao_id);

  if p_decisao = 'participar' then
    -- 2. Bloqueio ME/EPP pela empresa inteira — vale pra qualquer um que
    -- esteja chamando (Cliente, Admin ou Analista).
    select porte into v_porte_cliente from clientes where id = v_cliente_id;

    if v_porte_cliente = 'me_epp' then
      raise exception 'Empresas classificadas como ME/EPP não podem confirmar participação pelo sistema';
    end if;

    -- 1. Mesma regra de prazo da Proposta Comercial (migração 024).
    v_limite_absoluto := date_trunc('day', subtrair_dias_uteis(v_data_sessao, 1)) + interval '18 hours 30 minutes';
    if now() > v_limite_absoluto then
      raise exception 'Prazo encerrado definitivamente (1 dia útil antes da sessão, 18h30) — ninguém pode mais confirmar participação';
    end if;

    if not v_eh_staff then
      v_limite_normal := date_trunc('day', subtrair_dias_uteis(v_data_sessao, 4)) + interval '18 hours 30 minutes';

      if not (
        now() <= v_limite_normal
        or (coalesce(v_prazo_liberado, false) and v_prazo_liberado_ate is not null and now() <= v_prazo_liberado_ate)
      ) then
        raise exception 'O prazo para confirmar participação já encerrou (4 dias úteis antes da sessão, 18h30) — peça à Salutti para liberar novamente';
      end if;
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
