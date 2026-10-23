-- supabase/migrations/058_relatorio_disputas_cliente_definitivo.sql
--
-- Etapa 3A do plano dos Relatórios de gestão (23/10/2026).
-- Depende das migrações 054 (colunas novas da disputa) e 055 (liberação).
--
-- O QUE MUDA
--   Substitui relatorio_disputas_cliente() (versão da migração 044) para que o
--   painel do CLIENTE use as mesmas regras do painel interno:
--     1. Devolve disputas.homologado_em (resultado definitivo x provisório).
--     2. Devolve vitoria_por_convocacao e motivo_perda_habilitacao.
--     3. Devolve cnpj_vencedor e motivo_perda_evitavel SOMENTE quando o nome do
--        vencedor também é liberado (mesma regra do nome do vencedor).
--     4. Só devolve disputas de licitações JÁ LIBERADAS ao cliente
--        (licitacoes.liberada_ao_cliente_em preenchida).
--   Nada mais muda: mesmas chaves de liberação, mesmo SECURITY DEFINER.
--
-- COMO DESFAZER
--   Reaplicar a função da migração 044.
--
-- ATENÇÃO: faça o backup do Supabase antes de rodar.

create or replace function public.relatorio_disputas_cliente()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cliente_id uuid;
  v_chaves jsonb;
  v_mostrar_valor_vencedor boolean;
  v_mostrar_nome_vencedor boolean;
begin
  select u.cliente_id
    into v_cliente_id
  from usuarios_cliente u
  where u.auth_user_id = auth.uid()
    and u.status = 'ativo'
  limit 1;

  -- Não é usuário ativo de cliente.
  if v_cliente_id is null then
    return null;
  end if;

  v_chaves := relatorio_indicadores_cliente();

  -- Nada liberado a este usuário.
  if v_chaves is null or jsonb_array_length(v_chaves) = 0 then
    return '[]'::jsonb;
  end if;

  -- O valor do vencedor é necessário para concorrentes, perdas evitáveis,
  -- fora de mercado e distância da derrota. O NOME só para concorrentes,
  -- perdas evitáveis e concorrentes por família. Os demais indicadores de
  -- produtos e marcas não usam dados do vencedor.
  v_mostrar_valor_vencedor := v_chaves ?| array[
    'concorrentes', 'perdas_evitaveis', 'fora_de_mercado', 'distancia_derrota'
  ];
  v_mostrar_nome_vencedor := v_chaves ?| array[
    'concorrentes', 'perdas_evitaveis', 'concorrentes_familia'
  ];

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', d.id,
        'licitacao_id', d.licitacao_id,
        'data_sessao_realizada', d.data_sessao_realizada,
        'resultado', d.resultado,
        'homologado_em', d.homologado_em,
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
              'valor_vencedor', case when v_mostrar_valor_vencedor then di.valor_vencedor end,
              'nome_vencedor', case when v_mostrar_nome_vencedor then di.nome_vencedor end,
              'cnpj_vencedor', case when v_mostrar_nome_vencedor then di.cnpj_vencedor end,
              'motivo_perda_evitavel', case when v_mostrar_nome_vencedor then di.motivo_perda_evitavel end,
              'motivo_perda_habilitacao', di.motivo_perda_habilitacao,
              'vitoria_por_convocacao', di.vitoria_por_convocacao,
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
      and l.liberada_ao_cliente_em is not null
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.relatorio_disputas_cliente() from public, anon;
grant execute on function public.relatorio_disputas_cliente() to authenticated;
