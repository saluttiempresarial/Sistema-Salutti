-- 067_data_habilitacao_origem_verba_base_legal.sql
--
-- Três campos novos no cadastro da licitação (pedido de 17/11/2026), todos
-- opcionais e todos vindos do edital:
--   • data_habilitacao   – data e horário da fase de habilitação;
--   • origem_verba (+ detalhe) – de onde vem o recurso da contratação;
--   • base_legal (+ detalhe)   – lei ou norma em que a licitação se apoia.
-- Licitações já cadastradas ficam com os campos em branco.

alter table licitacoes add column if not exists data_habilitacao timestamptz;
alter table licitacoes add column if not exists origem_verba text;
alter table licitacoes add column if not exists origem_verba_detalhe text;
alter table licitacoes add column if not exists base_legal text;
alter table licitacoes add column if not exists base_legal_detalhe text;

alter table licitacoes drop constraint if exists licitacoes_origem_verba_check;
alter table licitacoes add constraint licitacoes_origem_verba_check
  check (origem_verba is null or origem_verba = any (array[
    'recursos_proprios', 'repasse_federal', 'repasse_estadual', 'fundo_especifico', 'outra'
  ]::text[]));

alter table licitacoes drop constraint if exists licitacoes_base_legal_check;
alter table licitacoes add constraint licitacoes_base_legal_check
  check (base_legal is null or base_legal = any (array[
    'lei_14133_2021', 'lei_13303_2016', 'regulamento_proprio', 'lei_8666_1993', 'lei_10520_2002', 'outra'
  ]::text[]));

-- Conferência: as cinco colunas devem aparecer na lista.
select column_name, data_type
from information_schema.columns
where table_name = 'licitacoes'
  and column_name in ('data_habilitacao', 'origem_verba', 'origem_verba_detalhe', 'base_legal', 'base_legal_detalhe')
order by column_name;
