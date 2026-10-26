-- supabase/migrations/059_disputa_acompanhamento_processo.sql
--
-- Tela da Disputa conforme o layout aprovado ("Tela Disputa – Resultado",
-- 26/10/2026). Depende das migrações 021, 036 e 054.
--
-- O QUE MUDA
--   1. disputas (nível do PROCESSO no órgão):
--        situacao_processo  em julgamento, em habilitação, em fase recursal,
--                           adjudicada, homologada, suspensa, deserta,
--                           fracassada, revogada ou anulada
--        acao_pendente      o que a Salutti/cliente precisa fazer agora
--        prazo_acao         data e hora limite da ação pendente
--        adjudicada_em      data da adjudicação
--      (homologado_em, da migração 054, continua sendo a "Homologada em".)
--   2. disputa_itens (RESULTADO DO CLIENTE por item/grupo):
--        resultado_item     passa a aceitar também 'arrematado_analise',
--                           'perdido_analise' e 'convocado'
--        motivo_perda       preço, desclassificado na proposta, inabilitado,
--                           item cancelado ou desistência do cliente
--   Nada é apagado: as colunas da migração 054 (motivos detalhados, CNPJ do
--   vencedor, vitória por convocação) continuam existindo.
--
-- COMO DESFAZER
--   alter table public.disputas
--     drop column if exists situacao_processo, drop column if exists acao_pendente,
--     drop column if exists prazo_acao, drop column if exists adjudicada_em;
--   alter table public.disputa_itens drop column if exists motivo_perda;
--   (e recriar a constraint disputa_itens_resultado_item_check sem os 3 valores novos,
--    depois de trocar esses resultados por 'ganho'/'perdido' nas linhas existentes)
--
-- ATENÇÃO: faça o backup do Supabase antes de rodar.

-- ---------------------------------------------------------------------------
-- 1. disputas
-- ---------------------------------------------------------------------------
alter table public.disputas
  add column if not exists situacao_processo text,
  add column if not exists acao_pendente text,
  add column if not exists prazo_acao timestamptz,
  add column if not exists adjudicada_em date;

alter table public.disputas
  drop constraint if exists disputas_situacao_processo_check;
alter table public.disputas
  add constraint disputas_situacao_processo_check
  check (situacao_processo is null
         or situacao_processo in ('em_julgamento', 'em_habilitacao', 'em_fase_recursal',
                                  'adjudicada', 'homologada', 'suspensa', 'deserta',
                                  'fracassada', 'revogada', 'anulada'));

alter table public.disputas
  drop constraint if exists disputas_acao_pendente_check;
alter table public.disputas
  add constraint disputas_acao_pendente_check
  check (acao_pendente is null
         or acao_pendente in ('nenhuma', 'enviar_proposta_ajustada', 'enviar_amostra',
                              'responder_diligencia', 'enviar_documentos_complementares',
                              'apresentar_recurso', 'apresentar_contrarrazoes'));

-- ---------------------------------------------------------------------------
-- 2. disputa_itens
-- ---------------------------------------------------------------------------
alter table public.disputa_itens
  add column if not exists motivo_perda text;

alter table public.disputa_itens
  drop constraint if exists disputa_itens_resultado_item_check;
alter table public.disputa_itens
  add constraint disputa_itens_resultado_item_check
  check (resultado_item is null
         or resultado_item in ('ganho', 'perdido', 'fracassado', 'deserto', 'cancelado',
                               'perdido_habilitacao',
                               'arrematado_analise', 'perdido_analise', 'convocado'));

alter table public.disputa_itens
  drop constraint if exists disputa_itens_motivo_perda_check;
alter table public.disputa_itens
  add constraint disputa_itens_motivo_perda_check
  check (motivo_perda is null
         or motivo_perda in ('preco', 'desclassificado_proposta', 'inabilitado',
                             'item_cancelado', 'desistencia_cliente'));

-- ---------------------------------------------------------------------------
-- 3. Conferência: os 3 resultados devem aparecer como true
-- ---------------------------------------------------------------------------
select
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'disputas'
      and column_name in ('situacao_processo', 'acao_pendente', 'prazo_acao', 'adjudicada_em')) = 4
    as colunas_disputas_ok,
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'disputa_itens'
      and column_name = 'motivo_perda') = 1
    as coluna_motivo_perda_ok,
  (select count(*) from pg_constraint
    where conname in ('disputa_itens_resultado_item_check', 'disputa_itens_motivo_perda_check',
                      'disputas_situacao_processo_check', 'disputas_acao_pendente_check')) = 4
    as constraints_ok;
