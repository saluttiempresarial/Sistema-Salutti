-- supabase/020_prazo_interno_4_dias_uteis.sql
--
-- Atualiza a regra de prazo interno (tabela `configuracoes`, linha única)
-- de 3 dias úteis / 18h00 para 4 dias úteis / 18h30 — a pedido do Márcio
-- (28/09). Sem isso, o padrão de fábrica novo do código (prazoUtils.ts)
-- não tem efeito nenhum, porque essa linha do banco tem prioridade.

update public.configuracoes
set dias_uteis_antes = 4,
    horario_limite = '18:30:00',
    atualizado_em = now()
where id = true;
