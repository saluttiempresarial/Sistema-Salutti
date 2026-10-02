-- 029_bloqueia_prazos_negativos.sql
--
-- A pedido do Márcio (02/10): nenhum valor negativo pode ser contabilizado
-- em nenhuma parte do sistema nos campos de prazo (em dias) de Condições
-- Comerciais — "Prazo de pagamento", "Prazo de entrega" e "Validade da
-- proposta" — seja o registro criado por Cliente, Admin ou Analista.
--
-- O front-end (LicitacaoFormModal.tsx) já trava esses três campos em 0 no
-- momento da digitação, mas essa trava sozinha não impede um valor
-- negativo entrar por outra via (edição direta no banco, uma chamada à
-- API feita fora da tela, um bug futuro no código). Esta migração fecha
-- a porta no próprio banco, que é a camada que garante a regra de
-- verdade.
--
-- Esses três campos NÃO são colunas da tabela `licitacoes` — eles ficam
-- dentro da coluna `condicoes_comerciais`, que é um único campo JSONB
-- (ver paraColunasLicitacao() em licitacaoService.ts, que grava o objeto
-- CondicoesComerciais inteiro ali, com as chaves em camelCase exatamente
-- como estão no TypeScript). Por isso o CHECK precisa ler para dentro do
-- JSON (->>'chave'), não comparar uma coluna direta.
--
-- Regra: cada campo só é bloqueado quando a chave existe E o valor dela,
-- convertido para número, é negativo. Ausência da chave (licitação sem
-- esse campo preenchido) continua permitida — null sempre foi e continua
-- um valor válido, só número negativo é que não pode.

alter table licitacoes
  add constraint prazo_pagamento_dias_nao_negativo
  check (
    (condicoes_comerciais ->> 'prazoPagamentoDias') is null
    or (condicoes_comerciais ->> 'prazoPagamentoDias')::numeric >= 0
  );

alter table licitacoes
  add constraint prazo_entrega_dias_nao_negativo
  check (
    (condicoes_comerciais ->> 'prazoEntregaDias') is null
    or (condicoes_comerciais ->> 'prazoEntregaDias')::numeric >= 0
  );

alter table licitacoes
  add constraint validade_proposta_dias_nao_negativo
  check (
    (condicoes_comerciais ->> 'validadePropostaDias') is null
    or (condicoes_comerciais ->> 'validadePropostaDias')::numeric >= 0
  );
