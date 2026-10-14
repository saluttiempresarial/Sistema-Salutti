-- supabase/migrations/044_indicadores_produtos_marcas.sql
--
-- Etapa 2 dos indicadores de PRODUTOS E MARCAS (Especificação de Relatórios e
-- Dashboards, seções 3.4 e 3.7). Os cálculos já existem no sistema (etapa 1);
-- esta migração prepara o banco para eles.
--
-- Novos indicadores (chaves):
--   taxa_vitoria_familia   Taxa de vitória por família            (A, N, R, O)
--   marcas                 Marcas mais cotadas e mais ganhas      (A, N, R, O)
--   produtos_nunca_ganhos  Produtos disputados e nunca ganhos     (A, N, R)
--   concorrentes_familia   Contra quem perde em cada família      (A, N, R)
--
-- O que esta migração faz:
--   1. Cadastra os quatro indicadores na liberação de nível 1
--      (relatorio_liberacao_perfil): liberados ao Analista e ao perfil
--      Cliente, como pede a coluna de perfis da especificação. O Administrador
--      pode desligar qualquer um em Configurações. Não sobrescreve nada que ele
--      já tenha alterado (on conflict do nothing).
--   2. Mantém os quatro FECHADOS para o Operador por padrão (o padrão do
--      Operador, migração 039, só abre funil, taxa_vitoria, volume_periodo,
--      familias e orgaos). O Responsável pode liberar caso a caso.
--   3. Substitui relatorio_disputas_cliente() (migração 042) para que o NOME do
--      vencedor também saia quando "concorrentes_familia" estiver liberado ao
--      usuário (além de concorrentes e perdas_evitaveis). O VALOR do vencedor
--      não muda. Os outros três indicadores não usam dados do vencedor.
--
-- Nada é alterado nos dados existentes. Nenhuma tela muda com esta migração:
-- os indicadores só aparecem quando as telas forem entregues (etapas 3 e 4).
--
-- Para desfazer:
--   delete from public.relatorio_liberacao_perfil
--    where indicador in ('taxa_vitoria_familia', 'marcas',
--                        'produtos_nunca_ganhos', 'concorrentes_familia');
--   delete from public.relatorio_liberacao_operador
--    where indicador in ('taxa_vitoria_familia', 'marcas',
--                        'produtos_nunca_ganhos', 'concorrentes_familia');
--   (e executar novamente a seção 2 da migração 042 para restaurar a função)

-- ---------------------------------------------------------------------------
-- 1. Catálogo: liberação de nível 1 dos quatro indicadores novos
-- ---------------------------------------------------------------------------
insert into public.relatorio_liberacao_perfil (indicador, perfil, liberado)
values
  ('taxa_vitoria_familia', 'analista', true),  ('taxa_vitoria_familia', 'cliente', true),
  ('marcas', 'analista', true),                ('marcas', 'cliente', true),
  ('produtos_nunca_ganhos', 'analista', true), ('produtos_nunca_ganhos', 'cliente', true),
  ('concorrentes_familia', 'analista', true),  ('concorrentes_familia', 'cliente', true)
on conflict (indicador, perfil) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Disputas do cliente: nome do vencedor também para concorrentes_familia
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

-- Conferência: deve listar 8 linhas, todas com liberado = true.
select indicador, perfil, liberado
  from public.relatorio_liberacao_perfil
 where indicador in ('taxa_vitoria_familia', 'marcas',
                     'produtos_nunca_ganhos', 'concorrentes_familia')
 order by indicador, perfil;
