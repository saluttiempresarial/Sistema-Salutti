-- supabase/033_familias_produto_estrutura.sql
--
-- Etapa 1 do módulo de Relatórios e Dashboards (07/10): estrutura da
-- biblioteca de FAMÍLIAS DE PRODUTOS, por cliente.
--
-- O que esta migração faz:
--   1) Cria a tabela familias_produto (uma biblioteca por cliente).
--   2) Garante nome único por cliente, sem diferenciar maiúsculas/minúsculas
--      nem espaços nas pontas ("Furadeira" e " FURADEIRA " são o mesmo nome).
--   3) Cria a coluna itens_licitacao.familia_id (opcional: item sem família
--      continua válido e aparece como "Sem família" nos painéis).
--   4) Impede ligar um item a uma família de OUTRO cliente (gatilho).
--   5) Habilita RLS e cria as policies + o GRANT (lição da migração 026:
--      tabela criada por SQL precisa do GRANT explícito ao role authenticated).
--
-- O que esta migração NÃO faz: não insere nenhuma família (a carga das 36
-- famílias iniciais vem em arquivo separado, 034) e não altera nenhum dado
-- existente. É 100% aditiva — nenhuma tabela ou coluna atual é modificada,
-- exceto a nova coluna familia_id (nula para todos os itens já existentes).
--
-- Regras de acesso:
--   - Admin: vê e altera tudo.
--   - Analista: vê e altera as famílias dos clientes que têm alguma licitação
--     da sua carteira (mesma regra funcionario_acessa_licitacao já usada em
--     disputa_itens).
--   - Cliente: só LÊ as famílias da própria empresa (cliente_acessa).
--   - Excluir família: só o Admin. Para tirar uma família de uso, o caminho
--     normal é desativar (ativo = false), que preserva o histórico dos itens.
--
-- Para desfazer (só se ainda não houver dados importantes):
--   drop trigger if exists trg_validar_familia_do_item on public.itens_licitacao;
--   drop function if exists public.validar_familia_do_item();
--   alter table public.itens_licitacao drop column if exists familia_id;
--   drop table if exists public.familias_produto;

-- 1) Tabela -------------------------------------------------------------------
create table public.familias_produto (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  nome text not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  constraint familias_produto_nome_preenchido check (btrim(nome) <> '')
);

-- 2) Nome único por cliente (sem diferenciar maiúsculas nem espaços nas pontas)
create unique index familias_produto_cliente_nome_uidx
  on public.familias_produto (cliente_id, lower(btrim(nome)));

create index familias_produto_cliente_idx on public.familias_produto (cliente_id);

-- 3) Coluna nos itens da licitação ----------------------------------------------
-- on delete set null: se uma família for excluída por engano, os itens não
-- somem — só ficam "sem família".
alter table public.itens_licitacao
  add column familia_id uuid references public.familias_produto(id) on delete set null;

create index itens_licitacao_familia_idx on public.itens_licitacao (familia_id);

-- 4) A família do item precisa ser do MESMO cliente da licitação --------------
create or replace function public.validar_familia_do_item()
returns trigger
language plpgsql
as $$
declare
  v_cliente_licitacao uuid;
  v_cliente_familia uuid;
begin
  if new.familia_id is null then
    return new;
  end if;

  select l.cliente_id into v_cliente_licitacao
  from public.licitacoes l
  where l.id = new.licitacao_id;

  select f.cliente_id into v_cliente_familia
  from public.familias_produto f
  where f.id = new.familia_id;

  if v_cliente_familia is distinct from v_cliente_licitacao then
    raise exception 'A família escolhida pertence a outro cliente.';
  end if;

  return new;
end;
$$;

create trigger trg_validar_familia_do_item
before insert or update of familia_id on public.itens_licitacao
for each row
execute function public.validar_familia_do_item();

-- 5) Segurança -------------------------------------------------------------------
alter table public.familias_produto enable row level security;

grant select, insert, update, delete on table public.familias_produto to authenticated;

-- Leitura: Admin, Analista (carteira) e o próprio Cliente.
create policy "familias_produto_select"
on public.familias_produto
for select
to authenticated
using (
  is_admin_ativo()
  or cliente_acessa(cliente_id)
  or exists (
    select 1 from public.licitacoes l
    where l.cliente_id = familias_produto.cliente_id
      and funcionario_acessa_licitacao(l.id)
  )
);

-- Cadastro e edição: Admin e Analista (o Cliente não cadastra família).
create policy "familias_produto_insert"
on public.familias_produto
for insert
to authenticated
with check (
  is_admin_ativo()
  or exists (
    select 1 from public.licitacoes l
    where l.cliente_id = familias_produto.cliente_id
      and funcionario_acessa_licitacao(l.id)
  )
);

create policy "familias_produto_update"
on public.familias_produto
for update
to authenticated
using (
  is_admin_ativo()
  or exists (
    select 1 from public.licitacoes l
    where l.cliente_id = familias_produto.cliente_id
      and funcionario_acessa_licitacao(l.id)
  )
)
with check (
  is_admin_ativo()
  or exists (
    select 1 from public.licitacoes l
    where l.cliente_id = familias_produto.cliente_id
      and funcionario_acessa_licitacao(l.id)
  )
);

-- Exclusão: só o Admin.
create policy "familias_produto_delete"
on public.familias_produto
for delete
to authenticated
using (is_admin_ativo());
