-- 063_tipo_contratacao_adesao_arp.sql
--
-- Tipo de contratação: sai "Inexigibilidade" e entra "Adesão à ARP (Ata de
-- Registro de Preços)". Licitações que estavam como Inexigibilidade ficam sem
-- tipo (em branco) para a equipe escolher de novo na edição.

-- 1) Conferência ANTES: quantas licitações estão como Inexigibilidade.
select count(*) as com_inexigibilidade
from licitacoes
where tipo_contratacao = 'inexigibilidade';

-- 2) Limpa o valor que deixa de existir.
update licitacoes
set tipo_contratacao = null
where tipo_contratacao = 'inexigibilidade';

-- 3) Nova regra de valores permitidos.
alter table licitacoes drop constraint if exists licitacoes_tipo_contratacao_check;

alter table licitacoes add constraint licitacoes_tipo_contratacao_check
  check (tipo_contratacao is null or tipo_contratacao = any (array['licitacao', 'dispensa', 'adesao_arp']::text[]));

-- 4) Conferência DEPOIS: a regra deve listar licitacao, dispensa e adesao_arp.
select pg_get_constraintdef(oid) as regra
from pg_constraint
where conname = 'licitacoes_tipo_contratacao_check';
