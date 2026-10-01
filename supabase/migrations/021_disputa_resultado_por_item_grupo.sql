-- supabase/021_disputa_resultado_por_item_grupo.sql
--
-- Reestrutura o resultado da Disputa: de um valor único pra licitação
-- inteira, para um resultado POR ITEM (ou por GRUPO inteiro, quando os
-- itens estão agrupados) — a pedido do Márcio (28/09), alinhado com a
-- planilha real da Salutti (aba "Produtos", bloco "RESULTADO DA
-- LICITAÇÃO") e com a aba "Lances por Item".
--
-- 1) Adiciona "homologado" como resultado possível.
-- 2) Remove os campos de valor único que saem de uso (posição/oferta/
--    vencedor únicos pra disputa inteira).
-- 3) Cria a tabela disputa_itens, 1 linha por item avulso OU por grupo
--    inteiro (nunca os dois), com posição e valor fechado.

-- 1) Resultado ganha "homologado" -------------------------------------
alter table public.disputas drop constraint if exists disputas_resultado_check;
alter table public.disputas
  add constraint disputas_resultado_check
  check (resultado in ('em_andamento', 'ganho', 'perdido', 'homologado'));

-- 2) Remove os campos de valor único da disputa inteira -----------------
alter table public.disputas drop column if exists valor_nossa_oferta_final;
alter table public.disputas drop column if exists valor_vencedor;
alter table public.disputas drop column if exists nome_vencedor;
alter table public.disputas drop column if exists posicao_final;

-- 3) Tabela disputa_itens -------------------------------------------------
create table public.disputa_itens (
  id uuid primary key default gen_random_uuid(),
  disputa_id uuid not null references public.disputas(id) on delete cascade,
  item_id uuid references public.itens_licitacao(id) on delete cascade,
  grupo_id uuid references public.grupos_itens_licitacao(id) on delete cascade,
  posicao integer,
  valor_fechado numeric,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  -- Ou é resultado de um item avulso, ou de um grupo inteiro — nunca os
  -- dois, nunca nenhum dos dois.
  constraint disputa_itens_item_xor_grupo check (
    (item_id is not null and grupo_id is null) or (item_id is null and grupo_id is not null)
  )
);

create index disputa_itens_disputa_id_idx on public.disputa_itens(disputa_id);

alter table public.disputa_itens enable row level security;

-- Mesma regra de acesso já usada em outras tabelas ligadas à licitação
-- (funcionario_acessa_licitacao já embute admin + checagem de carteira) —
-- aqui via subquery até a disputa, até a licitação.
create policy "disputa_itens_all"
on public.disputa_itens
for all
to authenticated
using (
  funcionario_acessa_licitacao(
    (select d.licitacao_id from public.disputas d where d.id = disputa_id)
  )
)
with check (
  funcionario_acessa_licitacao(
    (select d.licitacao_id from public.disputas d where d.id = disputa_id)
  )
);
