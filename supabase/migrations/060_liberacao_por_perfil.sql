-- supabase/migrations/060_liberacao_por_perfil.sql
--
-- Liberação por perfil dos Indicadores (documento "Relatórios do Sistema
-- Salutti — Consolidado", seção "Liberação por perfil"):
--
--   O Administrador vê tudo, sempre. O que ele liga para o Cliente é o LIMITE
--   MÁXIMO; dentro dele, o Responsável do cliente escolhe o que cada
--   funcionário (Operador) vê. O Analista vê só os clientes da carteira dele
--   (regra que já vale nas licitações, pela migração 010).
--
-- O que esta migração faz:
--   1. Aplica as colunas "Analista" e "Cliente (responsável)" da tabela do
--      documento em relatorio_liberacao_perfil. ATENÇÃO: para as chaves
--      abaixo, SOBRESCREVE o que o Administrador tiver marcado; indicadores
--      fora da tabela do documento ficam como estão.
--   2. Cria relatorio_indicadores_vetados_operador(): indicadores que o
--      funcionário do cliente NUNCA pode ver (o documento diz "Não" para ele,
--      porque mostram valores totais, margem ou medem a operação da Salutti).
--      Nem o Responsável consegue abri-los para um Operador.
--   3. Substitui relatorio_indicadores_cliente() (migração 039) e
--      relatorio_operadores_responsavel() (migração 040) para respeitar essa
--      lista. O padrão de quem ainda não foi configurado não muda.
--   4. Substitui relatorio_disputas_cliente() (migração 058) só para devolver
--      também disputa_itens.motivo_perda (059), usado em "Perdas na habilitação".
--      Depende das migrações 058 e 059.
--
-- Novas chaves de indicador: perdas_habilitacao, vitorias_convocacao,
-- alerta_acompanhamento. Saem do catálogo: aproveitamento (substituído pelo
-- Relatório principal, chave funil) e concorrentes_familia (substituída pelo
-- clique em "Concorrentes que mais vencem").
--
-- Para desfazer (a tabela volta ao que o Administrador salvar de novo):
--   drop function if exists public.relatorio_indicadores_vetados_operador();
--   e executar de novo as migrações 039, 040 e 058 para restaurar as funções.
--
-- ATENÇÃO: faça o backup do Supabase antes de rodar.

-- ---------------------------------------------------------------------------
-- 1. Tabela do documento: colunas Analista e Cliente (responsável)
-- ---------------------------------------------------------------------------
insert into public.relatorio_liberacao_perfil (indicador, perfil, liberado)
values
  -- Relatório principal (total e funil)
  ('funil', 'analista', true),                    ('funil', 'cliente', true),
  ('taxa_vitoria', 'analista', true),             ('taxa_vitoria', 'cliente', true),
  ('valor_adjudicado', 'analista', true),         ('valor_adjudicado', 'cliente', true),
  ('ganho_sobre_minimo', 'analista', true),       ('ganho_sobre_minimo', 'cliente', true),
  ('marcas', 'analista', true),                   ('marcas', 'cliente', true),
  ('distancia_derrota', 'analista', true),        ('distancia_derrota', 'cliente', true),
  ('motivos_nao_participacao', 'analista', true), ('motivos_nao_participacao', 'cliente', true),
  ('concorrentes', 'analista', true),             ('concorrentes', 'cliente', true),
  ('taxa_vitoria_familia', 'analista', true),     ('taxa_vitoria_familia', 'cliente', true),
  ('orgaos', 'analista', true),                   ('orgaos', 'cliente', true),
  ('desempenho_modalidade', 'analista', true),    ('desempenho_modalidade', 'cliente', true),
  ('perdas_habilitacao', 'analista', true),       ('perdas_habilitacao', 'cliente', true),
  ('vitorias_convocacao', 'analista', true),      ('vitorias_convocacao', 'cliente', true),
  ('fora_de_mercado', 'analista', true),          ('fora_de_mercado', 'cliente', true),
  -- Uso interno da Salutti: o Cliente não vê
  ('tempo_resposta', 'analista', true),           ('tempo_resposta', 'cliente', false),
  ('perdas_evitaveis', 'analista', true),         ('perdas_evitaveis', 'cliente', false),
  ('valor_por_cliente', 'analista', true),        ('valor_por_cliente', 'cliente', false),
  ('concentracao_carteira', 'analista', true),    ('concentracao_carteira', 'cliente', false),
  ('clientes_sem_atividade', 'analista', true),   ('clientes_sem_atividade', 'cliente', false),
  ('alerta_acompanhamento', 'analista', true),    ('alerta_acompanhamento', 'cliente', false),
  -- Saíram do catálogo: ficam fechados
  ('aproveitamento', 'analista', false),          ('aproveitamento', 'cliente', false),
  ('concorrentes_familia', 'analista', false),    ('concorrentes_familia', 'cliente', false)
on conflict (indicador, perfil)
do update set liberado = excluded.liberado, atualizado_em = now();

-- ---------------------------------------------------------------------------
-- 2. Indicadores que o funcionário (Operador) do cliente nunca vê
-- ---------------------------------------------------------------------------
create or replace function public.relatorio_indicadores_vetados_operador()
returns text[]
language sql
immutable
as $$
  select array[
    'valor_adjudicado',
    'ganho_sobre_minimo',
    'marcas',
    'perdas_habilitacao',
    'tempo_resposta',
    'perdas_evitaveis',
    'valor_por_cliente',
    'clientes_sem_atividade',
    'concentracao_carteira',
    'alerta_acompanhamento',
    'ticket_medio',
    'desconto_medio',
    'pipeline',
    'prazos_proximos',
    'aproveitamento'
  ]::text[]
$$;

grant execute on function public.relatorio_indicadores_vetados_operador() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Indicadores efetivamente liberados ao usuário de cliente logado
--    (substitui a função da migração 039)
-- ---------------------------------------------------------------------------
create or replace function public.relatorio_indicadores_cliente()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid;
  v_perfil text;
begin
  select u.id, u.perfil
    into v_usuario_id, v_perfil
  from usuarios_cliente u
  where u.auth_user_id = auth.uid()
    and u.status = 'ativo'
  limit 1;

  -- Não é usuário ativo de cliente.
  if v_usuario_id is null then
    return null;
  end if;

  return coalesce((
    select jsonb_agg(c.indicador order by c.indicador)
    from relatorio_liberacao_perfil c
    where c.perfil = 'cliente'
      and c.liberado
      and (
        v_perfil = 'gestor'
        or (
          not (c.indicador = any (public.relatorio_indicadores_vetados_operador()))
          and coalesce(
                (select o.liberado
                   from relatorio_liberacao_operador o
                  where o.usuario_id = v_usuario_id
                    and o.indicador = c.indicador),
                c.indicador in ('funil', 'taxa_vitoria', 'volume_periodo', 'familias', 'orgaos')
              )
        )
      )
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.relatorio_indicadores_cliente() from public, anon;
grant execute on function public.relatorio_indicadores_cliente() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Tela do Responsável: Operadores e o que cada um vê
--    (substitui a função da migração 040)
-- ---------------------------------------------------------------------------
create or replace function public.relatorio_operadores_responsavel()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cliente_id uuid;
  v_indicadores jsonb;
begin
  select u.cliente_id
    into v_cliente_id
  from usuarios_cliente u
  where u.auth_user_id = auth.uid()
    and u.status = 'ativo'
    and u.perfil = 'gestor'
  limit 1;

  if v_cliente_id is null then
    return null;
  end if;

  -- Só entram na tela o que o Administrador liberou ao Cliente E que o
  -- documento permite repassar a um funcionário.
  select coalesce(jsonb_agg(c.indicador order by c.indicador), '[]'::jsonb)
    into v_indicadores
  from relatorio_liberacao_perfil c
  where c.perfil = 'cliente'
    and c.liberado
    and not (c.indicador = any (public.relatorio_indicadores_vetados_operador()));

  return jsonb_build_object(
    'indicadores', v_indicadores,
    'operadores', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'usuario_id', op.id,
          'nome', op.nome,
          'email', op.email,
          'liberacoes', coalesce((
            select jsonb_object_agg(
              c.indicador,
              coalesce(
                (select o.liberado
                   from relatorio_liberacao_operador o
                  where o.usuario_id = op.id
                    and o.indicador = c.indicador),
                c.indicador in ('funil', 'taxa_vitoria', 'volume_periodo', 'familias', 'orgaos')
              )
            )
            from relatorio_liberacao_perfil c
            where c.perfil = 'cliente'
              and c.liberado
              and not (c.indicador = any (public.relatorio_indicadores_vetados_operador()))
          ), '{}'::jsonb)
        )
        order by op.nome
      )
      from usuarios_cliente op
      where op.cliente_id = v_cliente_id
        and op.perfil = 'operador'
        and op.status = 'ativo'
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.relatorio_operadores_responsavel() from public, anon;
grant execute on function public.relatorio_operadores_responsavel() to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Disputas do cliente: devolve também o motivo simples da perda
--    (substitui a função da migração 058; é o que o relatório "Perdas na
--    habilitação" usa para mostrar etapa e origem ao Cliente)
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
  -- fora de mercado e distância da derrota. O NOME só para concorrentes e
  -- perdas evitáveis.
  v_mostrar_valor_vencedor := v_chaves ?| array[
    'concorrentes', 'perdas_evitaveis', 'fora_de_mercado', 'distancia_derrota'
  ];
  v_mostrar_nome_vencedor := v_chaves ?| array[
    'concorrentes', 'perdas_evitaveis'
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
              'motivo_perda', di.motivo_perda,
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

-- Conferência: deve listar as chaves do documento com os valores abaixo
-- (tempo_resposta, perdas_evitaveis, valor_por_cliente e clientes_sem_atividade
-- fechados para o Cliente) e a função de veto com 15 chaves.
select indicador, perfil, liberado
  from public.relatorio_liberacao_perfil
 where indicador in ('funil','tempo_resposta','perdas_evitaveis','perdas_habilitacao','valor_por_cliente','clientes_sem_atividade','aproveitamento')
 order by indicador, perfil;

select array_length(public.relatorio_indicadores_vetados_operador(), 1) as chaves_vetadas_ao_operador;
