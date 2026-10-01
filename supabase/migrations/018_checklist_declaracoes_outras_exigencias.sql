-- 018_checklist_declaracoes_outras_exigencias.sql
--
-- Adiciona as colunas 'declaracoes' e 'outras_exigencias' à tabela
-- licitacoes, para suportar o novo modelo de checklist de exigências
-- (Habilitação, Declarações, Outras Exigências) criado em 25/09 a partir
-- do documento "Estrutura_Tela_Exigencias_Edital_SALUTTI_Final.docx".
--
-- A coluna 'habilitacao' (já existente, jsonb) NÃO precisa de migração —
-- seu conteúdo interno mudou de formato (texto livre -> checklist), mas
-- continua sendo um único blob jsonb, sem alteração de schema. Licitações
-- cadastradas antes desta mudança mantêm o texto livre antigo salvo (não é
-- apagado), só que a tela deixou de exibi-lo — reabre com o checklist em
-- branco (decisão tomada com o Márcio em 25/09: substituição total, não
-- migração automática do texto livre para o checklist).

alter table public.licitacoes
  add column if not exists declaracoes jsonb not null default '[]'::jsonb,
  add column if not exists outras_exigencias jsonb not null default '[]'::jsonb;

comment on column public.licitacoes.declaracoes is
  'Checklist de declarações exigidas no edital (ItemChecklistExigencia[] — ver src/types/licitacao.ts)';
comment on column public.licitacoes.outras_exigencias is
  'Checklist de outras exigências do edital, mapeado da seção "Aceitação do Produto" do documento SALUTTI (ItemChecklistExigencia[] — ver src/types/licitacao.ts)';
