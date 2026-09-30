-- supabase/027_unico_disputa_por_licitacao.sql
--
-- Corrige as disputas duplicadas criadas antes da migração 026 (cada
-- tentativa de "Salvar resultado" travava no permission denied de
-- disputa_itens, mas já tinha inserido a linha em `disputas` — sem
-- desfazer, cada tentativa deixou uma disputa órfã, sem nenhum item).
--
-- 1) Apaga as duplicadas, mantendo só a mais antiga (criado_em) por
--    licitacao_id. Como as órfãs nunca chegaram a ter item nenhum
--    (disputa_itens ficou vazio nelas), não há resultado sendo perdido.
-- 2) Impede que isso volte a acontecer: no máximo 1 disputa por
--    licitação, de vez (o próprio sistema já assume essa regra — é assim
--    que "licitacoesSemDisputa", em DisputasPage.tsx, decide o que
--    aparece no dropdown "+ Registrar disputa para...").

delete from public.disputas d
using (
  select id, row_number() over (partition by licitacao_id order by criado_em asc) as rn
  from public.disputas
) dup
where d.id = dup.id and dup.rn > 1;

alter table public.disputas
  add constraint disputas_licitacao_id_unique unique (licitacao_id);
