-- supabase/022_disputa_itens_total_fechado.sql
--
-- A pedido do Márcio (29/09): "Total" deixa de ser calculado automaticamente
-- (Valor Fechado × quantidade) e passa a ser preenchido manualmente por
-- admin/analista, igual Posição e Valor Fechado — o valor total mostrado no
-- portal pode diferir um pouco da multiplicação simples, por arredondamento.
-- Só o % Acima do Mínimo continua calculado automaticamente pelo sistema.

alter table public.disputa_itens
  add column total_fechado numeric;
