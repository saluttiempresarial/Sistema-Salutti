-- supabase/036_disputa_itens_resultado_vencedor.sql
--
-- Etapa 2 (parte 2) dos Relatórios e Dashboards: resultado POR ITEM na
-- Disputa. Acrescenta à tabela disputa_itens (migração 021) os campos que
-- os relatórios precisam para saber, item a item, quem ganhou e por quanto:
--
--   resultado_item  ganho | perdido | fracassado | deserto | cancelado
--   valor_vencedor  valor unitário do vencedor (quando perdemos)
--   nome_vencedor   nome da empresa vencedora (quando perdemos)
--   observacao      texto livre do analista
--
-- Todas as colunas são OPCIONAIS: as disputas já registradas continuam
-- válidas, apenas sem o resultado do item. Nenhum dado existente é alterado.
-- Nossa oferta final continua sendo valor_fechado ("Valor ofertado" na tela)
-- e a posição continua em posicao.
--
-- Segurança: a tabela já tem RLS (policy disputa_itens_all, migração 021) e
-- grant para authenticated; colunas novas herdam ambos. Nada a recriar.
--
-- ROLLBACK (se precisar desfazer):
--   alter table public.disputa_itens
--     drop column if exists resultado_item,
--     drop column if exists valor_vencedor,
--     drop column if exists nome_vencedor,
--     drop column if exists observacao;

alter table public.disputa_itens
  add column if not exists resultado_item text,
  add column if not exists valor_vencedor numeric,
  add column if not exists nome_vencedor text,
  add column if not exists observacao text;

alter table public.disputa_itens
  drop constraint if exists disputa_itens_resultado_item_check;
alter table public.disputa_itens
  add constraint disputa_itens_resultado_item_check
  check (resultado_item is null
         or resultado_item in ('ganho', 'perdido', 'fracassado', 'deserto', 'cancelado'));

alter table public.disputa_itens
  drop constraint if exists disputa_itens_valor_vencedor_check;
alter table public.disputa_itens
  add constraint disputa_itens_valor_vencedor_check
  check (valor_vencedor is null or valor_vencedor >= 0);

-- Conferência (rode depois, se quiser): deve listar as 4 colunas novas.
-- select column_name, data_type
--   from information_schema.columns
--  where table_schema = 'public' and table_name = 'disputa_itens'
--    and column_name in ('resultado_item', 'valor_vencedor', 'nome_vencedor', 'observacao');
