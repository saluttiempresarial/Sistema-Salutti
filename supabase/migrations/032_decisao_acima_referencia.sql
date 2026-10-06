-- supabase/032_decisao_acima_referencia.sql
--
-- Regra de negócio pedida pelo Márcio (06/10): quando o total de um grupo
-- (ou um item individual) da Proposta Comercial do Cliente fica ACIMA do
-- valor de referência do edital, a participação nele só vale se o Admin ou
-- o Analista LIBERAR. Se eles entenderem que não dá para concorrer, marcam
-- "Não participar" — e isso precisa aparecer na tela de Disputa.
--
-- Como fica gravado: uma decisão por item (itens_licitacao). A decisão de
-- um grupo é gravada em todos os itens do grupo, de uma vez só.
--   NULL      = pendente (acima da referência, ninguém decidiu ainda)
--   'liberado' = Admin/Analista liberou a participação
--   'barrado'  = Admin/Analista decidiu NÃO participar
--
-- Se o Cliente (ou quem for) mudar o Preço Mínimo do item depois da
-- decisão, a decisão volta a ser "pendente" — ela valia para o preço
-- antigo. Isso é feito por um gatilho (trigger), então vale também quando
-- o Cliente apaga a proposta ou desiste da licitação.
--
-- Como aplicar: colar no SQL Editor do Supabase e executar (uma vez só).
-- É seguro rodar de novo.

alter table public.itens_licitacao
  add column if not exists decisao_acima_referencia text
    check (decisao_acima_referencia in ('liberado', 'barrado')),
  add column if not exists decisao_acima_referencia_por text,
  add column if not exists decisao_acima_referencia_em timestamptz;

-- Preço mudou → a decisão antiga deixa de valer.
create or replace function public.resetar_decisao_acima_referencia()
returns trigger
language plpgsql
as $$
begin
  if new.proposta_preco_minimo is distinct from old.proposta_preco_minimo
     and new.decisao_acima_referencia is not distinct from old.decisao_acima_referencia then
    new.decisao_acima_referencia := null;
    new.decisao_acima_referencia_por := null;
    new.decisao_acima_referencia_em := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_resetar_decisao_acima_referencia on public.itens_licitacao;

create trigger trg_resetar_decisao_acima_referencia
before update of proposta_preco_minimo on public.itens_licitacao
for each row
execute function public.resetar_decisao_acima_referencia();

-- Registra (ou desfaz, com p_decisao = null) a decisão para um ou mais
-- itens da MESMA licitação. Só Admin ativo ou Analista com carteira sobre
-- a licitação — o Cliente não consegue chamar isto com sucesso, nem direto
-- pela API.
create or replace function public.decidir_participacao_acima_referencia(
  p_item_ids uuid[],
  p_decisao text,
  p_usuario text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_licitacao_id uuid;
begin
  if p_decisao is not null and p_decisao not in ('liberado', 'barrado') then
    raise exception 'Decisão inválida: %', p_decisao;
  end if;

  if p_item_ids is null or coalesce(array_length(p_item_ids, 1), 0) = 0 then
    return;
  end if;

  if (select count(distinct licitacao_id) from itens_licitacao where id = any(p_item_ids)) <> 1 then
    raise exception 'Os itens precisam existir e ser de uma única licitação';
  end if;

  select distinct licitacao_id into v_licitacao_id
  from itens_licitacao
  where id = any(p_item_ids);

  if not (is_admin_ativo() or funcionario_acessa_licitacao(v_licitacao_id)) then
    raise exception 'Somente o Administrador ou o Analista da licitação pode liberar ou barrar a participação';
  end if;

  update itens_licitacao
  set
    decisao_acima_referencia = p_decisao,
    decisao_acima_referencia_por = case when p_decisao is null then null else p_usuario end,
    decisao_acima_referencia_em = case when p_decisao is null then null else now() end
  where id = any(p_item_ids);
end;
$$;
