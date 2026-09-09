-- 007_proposta_descricao_produto.sql
--
-- A planilha real da Salutti (aba "Produtos", bloco "Proposta Comercial")
-- tem uma coluna "Descrição" própria do produto ofertado pelo cliente,
-- separada da Descrição do item de referência (preenchida pelo Analista).
-- Essa coluna nunca tinha sido migrada para o banco — só existiam
-- proposta_codigo_interno / proposta_marca / proposta_modelo /
-- proposta_preco_minimo. Sem ela, a tela de Proposta Comercial não
-- consegue bater 100% com a planilha.

alter table itens_licitacao
  add column if not exists proposta_descricao text;
