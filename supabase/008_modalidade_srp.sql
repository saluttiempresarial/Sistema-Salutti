-- 008_modalidade_srp.sql
--
-- Adiciona "Sistema de Registro de Preços (SRP)" como modalidade válida
-- de licitação. A tabela tinha uma CHECK constraint
-- (licitacoes_modalidade_check) que só aceitava os valores antigos —
-- sem essa migração, salvar uma licitação com modalidade "srp" falha.

alter table licitacoes drop constraint licitacoes_modalidade_check;

alter table licitacoes add constraint licitacoes_modalidade_check
  check (modalidade = any (array[
    'pregao_eletronico',
    'concorrencia',
    'tomada_de_precos',
    'convite',
    'dispensa',
    'inexigibilidade',
    'srp'
  ]::text[]));
