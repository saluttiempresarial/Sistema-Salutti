-- supabase/migrations/054_campos_relatorios_gestao.sql
--
-- Etapa 1 do plano dos Relatórios de gestão (22/10/2026): cria no banco os
-- campos que os relatórios novos precisam. Esta migração é SOMENTE de
-- estrutura: todas as colunas são opcionais (ou têm valor padrão), nada
-- muda no comportamento do sistema e nenhuma tela existente é afetada.
-- As telas e os cálculos que usam estes campos vêm nas próximas etapas.
--
-- O QUE É CRIADO
--
-- licitacoes
--   liberada_ao_cliente_em   quando o analista liberou a licitação ao cliente
--                            (base do item 8: antecedência, janela e tempo
--                            de resposta). As licitações já cadastradas
--                            recebem a data de cadastro, para continuarem
--                            visíveis; as novas nascem SEM data (ainda não
--                            liberadas) — o botão "Liberar para o cliente"
--                            e a regra de visibilidade vêm na Etapa 2.
--   liberada_ao_cliente_por  nome de quem liberou
--   orgao_cnpj, orgao_uasg   identificação do órgão (item 10)
--   prazo_liberacoes_qtd     quantas vezes o Administrador liberou o prazo
--                            do cliente depois de encerrado (item 8)
--
-- disputas
--   homologado_em            data da homologação. Vazio = resultado
--                            provisório; preenchido = definitivo.
--
-- disputa_itens
--   resultado_item           passa a aceitar também 'perdido_habilitacao'
--                            (ganho no lance, perdido na aceitação ou
--                            habilitação)
--   motivo_perda_habilitacao motivo da perda na aceitação/habilitação; a
--                            etapa e a origem (indústria, produto, Salutti,
--                            cliente) saem do motivo, não são gravadas
--   motivo_perda_evitavel    motivo da perda evitável (item 12)
--   vitoria_por_convocacao   ganhou porque concorrentes foram
--                            desclassificados e a vez passou ao cliente
--   cnpj_vencedor            CNPJ do vencedor, só números (item 7)
--
-- itens_licitacao
--   proposta_marcas_composicao  marcas que compõem o item (cestas e kits)
--
-- configuracoes
--   inatividade_faixa_1/2/3_dias  faixas de "Clientes sem atividade"
--                                 (padrão 7, 14 e 21 dias)
--
-- SEGURANÇA: as tabelas já têm RLS (Row Level Security — regras de acesso
-- por linha) e permissões; as colunas novas herdam ambas. Nada a recriar.
--
-- ANTES DE RODAR: faça backup ou exporte os dados (o Supabase é de produção).
--
-- ROLLBACK (se precisar desfazer):
--   alter table public.licitacoes
--     drop column if exists liberada_ao_cliente_em,
--     drop column if exists liberada_ao_cliente_por,
--     drop column if exists orgao_cnpj,
--     drop column if exists orgao_uasg,
--     drop column if exists prazo_liberacoes_qtd;
--   alter table public.disputas drop column if exists homologado_em;
--   alter table public.disputa_itens
--     drop column if exists motivo_perda_habilitacao,
--     drop column if exists motivo_perda_evitavel,
--     drop column if exists vitoria_por_convocacao,
--     drop column if exists cnpj_vencedor;
--   alter table public.disputa_itens drop constraint if exists disputa_itens_resultado_item_check;
--   alter table public.disputa_itens add constraint disputa_itens_resultado_item_check
--     check (resultado_item is null
--            or resultado_item in ('ganho', 'perdido', 'fracassado', 'deserto', 'cancelado'));
--   alter table public.itens_licitacao drop column if exists proposta_marcas_composicao;
--   alter table public.configuracoes
--     drop column if exists inatividade_faixa_1_dias,
--     drop column if exists inatividade_faixa_2_dias,
--     drop column if exists inatividade_faixa_3_dias;

-- ---------------------------------------------------------------------------
-- 1. licitacoes
-- ---------------------------------------------------------------------------
alter table public.licitacoes
  add column if not exists liberada_ao_cliente_em timestamptz,
  add column if not exists liberada_ao_cliente_por text,
  add column if not exists orgao_cnpj text,
  add column if not exists orgao_uasg text,
  add column if not exists prazo_liberacoes_qtd integer not null default 0;

-- As licitações que já existem continuam visíveis ao cliente: recebem a data
-- de cadastro como data de liberação. Só mexe nas que ainda não têm data.
update public.licitacoes
   set liberada_ao_cliente_em = criado_em
 where liberada_ao_cliente_em is null;

alter table public.licitacoes
  drop constraint if exists licitacoes_prazo_liberacoes_qtd_check;
alter table public.licitacoes
  add constraint licitacoes_prazo_liberacoes_qtd_check
  check (prazo_liberacoes_qtd >= 0);

-- ---------------------------------------------------------------------------
-- 2. disputas
-- ---------------------------------------------------------------------------
alter table public.disputas
  add column if not exists homologado_em timestamptz;

-- ---------------------------------------------------------------------------
-- 3. disputa_itens
-- ---------------------------------------------------------------------------
alter table public.disputa_itens
  add column if not exists motivo_perda_habilitacao text,
  add column if not exists motivo_perda_evitavel text,
  add column if not exists vitoria_por_convocacao boolean not null default false,
  add column if not exists cnpj_vencedor text;

alter table public.disputa_itens
  drop constraint if exists disputa_itens_resultado_item_check;
alter table public.disputa_itens
  add constraint disputa_itens_resultado_item_check
  check (resultado_item is null
         or resultado_item in ('ganho', 'perdido', 'fracassado', 'deserto', 'cancelado',
                               'perdido_habilitacao'));

alter table public.disputa_itens
  drop constraint if exists disputa_itens_motivo_perda_habilitacao_check;
alter table public.disputa_itens
  add constraint disputa_itens_motivo_perda_habilitacao_check
  check (motivo_perda_habilitacao is null
         or motivo_perda_habilitacao in (
              'desclass_documentacao_produto',   -- ficha técnica, catálogo, registro ou certificação (indústria)
              'desclass_amostra_especificacao',  -- amostra reprovada ou especificação não atendida (produto)
              'desclass_erro_proposta',          -- erro na proposta: preço, marca, modelo (Salutti)
              'inabil_documento_habilitacao',    -- documento de habilitação vencido ou faltante (cliente)
              'inabil_qualificacao',             -- qualificação técnica ou econômico-financeira (cliente)
              'perdido_recurso'                  -- perdido em recurso
            ));

alter table public.disputa_itens
  drop constraint if exists disputa_itens_motivo_perda_evitavel_check;
alter table public.disputa_itens
  add constraint disputa_itens_motivo_perda_evitavel_check
  check (motivo_perda_evitavel is null
         or motivo_perda_evitavel in (
              'lance_nao_chegou_minimo',         -- o lance não chegou ao mínimo
              'nao_classificado_etapa_fechada',  -- não classificado para a etapa fechada
              'erro_cadastro_proposta',          -- erro no cadastro da proposta
              'outro'
            ));

-- CNPJ só com 14 números (a tela grava sem pontuação).
alter table public.disputa_itens
  drop constraint if exists disputa_itens_cnpj_vencedor_check;
alter table public.disputa_itens
  add constraint disputa_itens_cnpj_vencedor_check
  check (cnpj_vencedor is null or cnpj_vencedor ~ '^[0-9]{14}$');

-- ---------------------------------------------------------------------------
-- 4. itens_licitacao
-- ---------------------------------------------------------------------------
alter table public.itens_licitacao
  add column if not exists proposta_marcas_composicao text[];

-- ---------------------------------------------------------------------------
-- 5. configuracoes (faixas de "Clientes sem atividade")
-- ---------------------------------------------------------------------------
alter table public.configuracoes
  add column if not exists inatividade_faixa_1_dias integer not null default 7,
  add column if not exists inatividade_faixa_2_dias integer not null default 14,
  add column if not exists inatividade_faixa_3_dias integer not null default 21;

alter table public.configuracoes
  drop constraint if exists configuracoes_inatividade_faixas_check;
alter table public.configuracoes
  add constraint configuracoes_inatividade_faixas_check
  check (inatividade_faixa_1_dias >= 1
         and inatividade_faixa_1_dias < inatividade_faixa_2_dias
         and inatividade_faixa_2_dias < inatividade_faixa_3_dias);

-- ---------------------------------------------------------------------------
-- 6. Conferência — deve listar 14 linhas (uma por coluna criada), todas com
--    existe = true. O editor do Supabase mostra só o resultado da última
--    consulta, por isso tudo vem em uma só.
-- ---------------------------------------------------------------------------
select t.tabela, t.coluna,
       exists (
         select 1 from information_schema.columns c
          where c.table_schema = 'public'
            and c.table_name = t.tabela
            and c.column_name = t.coluna
       ) as existe
  from (values
    ('licitacoes',      'liberada_ao_cliente_em'),
    ('licitacoes',      'liberada_ao_cliente_por'),
    ('licitacoes',      'orgao_cnpj'),
    ('licitacoes',      'orgao_uasg'),
    ('licitacoes',      'prazo_liberacoes_qtd'),
    ('disputas',        'homologado_em'),
    ('disputa_itens',   'motivo_perda_habilitacao'),
    ('disputa_itens',   'motivo_perda_evitavel'),
    ('disputa_itens',   'vitoria_por_convocacao'),
    ('disputa_itens',   'cnpj_vencedor'),
    ('itens_licitacao', 'proposta_marcas_composicao'),
    ('configuracoes',   'inatividade_faixa_1_dias'),
    ('configuracoes',   'inatividade_faixa_2_dias'),
    ('configuracoes',   'inatividade_faixa_3_dias')
  ) as t(tabela, coluna)
 order by t.tabela, t.coluna;
