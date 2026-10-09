-- supabase/migrations/038_relatorio_disputas_cliente.sql
--
-- Painel de Indicadores do CLIENTE (Especificação de Relatórios e Dashboards,
-- seção 4). O cliente já lê as próprias licitações, itens e famílias pelas
-- regras existentes, mas NÃO tem acesso às tabelas `disputas` e
-- `disputa_itens` (a policy delas só reconhece Administrador e Analista da
-- carteira). Sem os resultados da disputa não há taxa de vitória.
--
-- Em vez de abrir essas tabelas ao cliente (o que exporia todas as colunas,
-- inclusive observações internas, e ignoraria a liberação), esta função
-- entrega SÓ o que o painel precisa, e só da empresa do usuário logado:
--
--   * Quem pode: usuário ativo de cliente com perfil 'gestor' (Responsável).
--     Para os demais (Operador ou quem não é usuário de cliente) devolve
--     JSON null — "sem acesso" —, porque a liberação de nível 2 (o Responsável
--     decidir o que cada operador vê) ainda não existe. A lista vazia '[]'
--     significa apenas "acesso permitido, sem disputas".
--   * Se nenhum indicador estiver liberado ao perfil Cliente (nível 1,
--     migração 037), devolve lista vazia.
--   * Campos do vencedor (valor e nome) só saem se algum indicador que os usa
--     estiver liberado ao Cliente: 'concorrentes' ou 'perdas_evitaveis'.
--   * Nunca saem: observações, link da ata e qualquer outro campo interno.
--
-- Devolve um JSON: lista de disputas, cada uma com a lista "itens".
--
-- Para desfazer:
--   drop function if exists public.relatorio_disputas_cliente();

create or replace function public.relatorio_disputas_cliente()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cliente_id uuid;
  v_perfil text;
  v_algum_liberado boolean;
  v_mostrar_vencedor boolean;
begin
  select u.cliente_id, u.perfil
    into v_cliente_id, v_perfil
  from usuarios_cliente u
  where u.auth_user_id = auth.uid()
    and u.status = 'ativo'
  limit 1;

  -- Não é usuário ativo de cliente (ou é Operador, ainda sem nível 2).
  if v_cliente_id is null or v_perfil <> 'gestor' then
    return null;
  end if;

  select
    coalesce(bool_or(r.liberado), false),
    coalesce(bool_or(r.liberado and r.indicador in ('concorrentes', 'perdas_evitaveis')), false)
    into v_algum_liberado, v_mostrar_vencedor
  from relatorio_liberacao_perfil r
  where r.perfil = 'cliente';

  if not v_algum_liberado then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', d.id,
        'licitacao_id', d.licitacao_id,
        'data_sessao_realizada', d.data_sessao_realizada,
        'resultado', d.resultado,
        'criado_em', d.criado_em,
        'atualizado_em', d.atualizado_em,
        'itens', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', di.id,
              'disputa_id', di.disputa_id,
              'item_id', di.item_id,
              'grupo_id', di.grupo_id,
              'posicao', di.posicao,
              'valor_fechado', di.valor_fechado,
              'total_fechado', di.total_fechado,
              'resultado_item', di.resultado_item,
              'valor_vencedor', case when v_mostrar_vencedor then di.valor_vencedor end,
              'nome_vencedor', case when v_mostrar_vencedor then di.nome_vencedor end,
              'criado_em', di.criado_em,
              'atualizado_em', di.atualizado_em
            )
          )
          from disputa_itens di
          where di.disputa_id = d.id
        ), '[]'::jsonb)
      )
    )
    from disputas d
    join licitacoes l on l.id = d.licitacao_id
    where l.cliente_id = v_cliente_id
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.relatorio_disputas_cliente() from public, anon;
grant execute on function public.relatorio_disputas_cliente() to authenticated;
