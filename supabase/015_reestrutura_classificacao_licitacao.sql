-- 015_reestrutura_classificacao_licitacao.sql
--
-- Reestrutura a classificação da licitação, separando 4 conceitos que
-- antes estavam misturados num único campo "Modalidade":
--
-- 1. Modalidade         — Pregão / Concorrência (reduzido de 7 pra 2 opções)
-- 2. Participação       — Exclusiva ME/EPP / Ampla concorrência
--                          (reaproveitando a coluna já existente, que
--                          antes guardava "Individual/Por lote")
-- 3. Estrutura (NOVA)   — Item / Lote-Grupo
--                          (assumiu o conceito que "Participação" tinha)
-- 4. Tipo de Contratação (NOVA) — Licitação / Dispensa / Inexigibilidade
-- 5. Procedimento (NOVA)        — Contratação convencional / SRP
--
-- Confirmado com o Márcio: não existem licitações reais cadastradas com
-- as modalidades removidas (Tomada de Preços, Convite, Dispensa,
-- Inexigibilidade, SRP) — só dados de teste, sem necessidade de migração
-- de dados existentes.

alter table licitacoes
  add column if not exists estrutura text,
  add column if not exists tipo_contratacao text,
  add column if not exists procedimento text;

-- Reduz a Modalidade só a Pregão/Concorrência — limpa valores antigos
-- (Tomada de Preços, Convite, Dispensa, Inexigibilidade, SRP) primeiro,
-- caindo em 'pregao_eletronico' como padrão seguro, pra constraint não
-- falhar em cima de dado de teste já cadastrado com essas modalidades
-- antigas (é só dado de teste, confirmado com o Márcio).
update licitacoes set modalidade = 'pregao_eletronico'
  where modalidade not in ('pregao_eletronico', 'concorrencia');

alter table licitacoes drop constraint if exists licitacoes_modalidade_check;
alter table licitacoes add constraint licitacoes_modalidade_check
  check (modalidade = any (array['pregao_eletronico', 'concorrencia']::text[]));

-- Participação agora é sempre um destes dois valores (era texto livre
-- antes, sem constraint nenhuma) — limpa valores antigos tipo "Individual"
-- ou "Por lote" primeiro, pra constraint não falhar em cima de dado de teste.
update licitacoes set participacao = null
  where participacao is not null
  and participacao not in ('exclusiva_me_epp', 'ampla_concorrencia');

alter table licitacoes add constraint licitacoes_participacao_check
  check (participacao is null or participacao = any (array['exclusiva_me_epp', 'ampla_concorrencia']::text[]));

alter table licitacoes add constraint licitacoes_estrutura_check
  check (estrutura is null or estrutura = any (array['item', 'lote_grupo']::text[]));

alter table licitacoes add constraint licitacoes_tipo_contratacao_check
  check (tipo_contratacao is null or tipo_contratacao = any (array['licitacao', 'dispensa', 'inexigibilidade']::text[]));

alter table licitacoes add constraint licitacoes_procedimento_check
  check (procedimento is null or procedimento = any (array['convencional', 'srp']::text[]));
