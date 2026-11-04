-- 062_estrutura_item_lote_grupo.sql
--
-- A Estrutura da licitação passa a aceitar uma terceira opção: "Item + Lote/Grupo"
-- (licitação com itens avulsos e lotes/grupos ao mesmo tempo). Só troca a regra
-- de valores permitidos da coluna; nenhum dado existente muda.

alter table licitacoes drop constraint if exists licitacoes_estrutura_check;

alter table licitacoes add constraint licitacoes_estrutura_check
  check (estrutura is null or estrutura = any (array['item', 'lote_grupo', 'item_lote_grupo']::text[]));

-- Conferência (deve mostrar a regra nova com os 3 valores):
select pg_get_constraintdef(oid) as regra
from pg_constraint
where conname = 'licitacoes_estrutura_check';
