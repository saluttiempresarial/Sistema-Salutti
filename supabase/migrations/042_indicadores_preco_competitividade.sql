-- supabase/migrations/042_indicadores_preco_competitividade.sql
--
-- Etapa 2 dos indicadores de PREÇO E COMPETITIVIDADE (Especificação de
-- Relatórios e Dashboards, seções 3.3 e 3.5). Os cálculos já existem no
-- sistema (etapa 1); esta migração prepara o banco para eles.
--
-- Novos indicadores (chaves):
--   valor_adjudicado   Valor adjudicado por período          (A, N, R)
--   ticket_medio       Ticket médio por licitação ganha      (A, N, R)
--   fora_de_mercado    Vencedor abaixo do mínimo do cliente  (A, N, R)
--   distancia_derrota  Quanto ficamos acima do vencedor      (A, N, R)
--   desconto_medio     Desconto médio sobre a referência     (A, N, R)
--
-- O que esta migração faz:
--   1. Cadastra os cinco indicadores na liberação de nível 1
--      (relatorio_liberacao_perfil): liberados ao Analista e ao perfil
--      Cliente, como pede a coluna de perfis da especificação. O Administrador
--      pode desligar qualquer um em Configurações. Não sobrescreve nada que ele
--      já tenha alterado (on conflict do nothing).
--   2. Mantém esses cinco FECHADOS para o Operador por padrão: o padrão do
--      Operador (migração 039) só abre funil, taxa_vitoria, volume_periodo,
--      familias e orgaos. Chave fora dessa lista começa fechada, então nenhuma
--      função precisa mudar para isso. O Responsável pode liberar caso a caso.
--   3. Substitui relatorio_disputas_cliente() (migração 039) para separar o
--      VALOR do vencedor do NOME do vencedor:
--        * valor_vencedor sai se estiver liberado ao usuário: concorrentes,
--          perdas_evitaveis, fora_de_mercado ou distancia_derrota;
--        * nome_vencedor continua saindo SOMENTE com concorrentes ou
--          perdas_evitaveis.
--      Assim o cliente vê a distância da derrota e o que está fora de mercado,
--      mas não identifica o concorrente.
--
-- Nada é alterado nos dados existentes. Nenhuma tela muda com esta migração:
-- os indicadores só aparecem para o usuário quando as telas forem entregues
-- (etapas 3 e 4).
--
-- Para desfazer:
--   delete from public.relatorio_liberacao_perfil
--    where indicador in ('valor_adjudicado', 'ticket_medio', 'fora_de_mercado',
--                        'distancia_derrota', 'desconto_medio');
--   delete from public.relatorio_liberacao_operador
--    where indicador in ('valor_adjudicado', 'ticket_medio', 'fora_de_mercado',
--                        'distancia_derrota', 'desconto_medio');
--   (e executar novamente a seção 3 da migração 039 para restaurar a função)

-- ---------------------------------------------------------------------------
-- 1. Catálogo: liberação de nível 1 dos cinco indicadores novos
-- ---------------------------------------------------------------------------
insert into public.relatorio_liberacao_perfil (indicador, perfil, liberado)
values
  ('valor_adjudicado', 'analista', true),  ('valor_adjudicado', 'cliente', true),
  ('ticket_medio', 'analista', true),      ('ticket_medio', 'cliente', true),
  ('fora_de_mercado', 'analista', true),   ('fora_de_mercado', 'cliente', true),
  ('distancia_derrota', 'analista', true), ('distancia_derrota', 'cliente', true),
  ('desconto_medio', 'analista', true),    ('desconto_medio', 'cliente', true)
on conflict (indicador, perfil) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Disputas do cliente: valor do vencedor separado do nome do vencedor
-- ---------------------------------------------------------------------------
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
  -- fora de mercado e distância da derrota. O NOME só para os dois primeiros.
  v_mostrar_valor_vencedor := v_chaves ?| array[
    'concorrentes', 'perdas_evitaveis', 'fora_de_mercado', 'distancia_derrota'
  ];
  v_mostrar_nome_vencedor := v_chaves ?| array['concorrentes', 'perdas_evitaveis'];

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
              'valor_vencedor', case when v_mostrar_valor_vencedor then di.valor_vencedor end,
              'nome_vencedor', case when v_mostrar_nome_vencedor then di.nome_vencedor end,
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
