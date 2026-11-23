-- supabase/migrations/068_documentos_edital_storage.sql
--
-- Documentos do edital de verdade (antes o campo era simulado: só o nome do
-- arquivo era gravado, e o arquivo não ia para lugar nenhum).
--
-- O que esta migração cria:
--   1) Bucket PRIVADO "documentos-edital" no Supabase Storage (50 MB por
--      arquivo, qualquer tipo de arquivo).
--   2) Tabela licitacao_documentos: uma linha por arquivo de cada licitação
--      (nome original, caminho no Storage, tamanho, tipo, quem enviou, data).
--   3) Regras de acesso (RLS):
--        - Administrador ativo e Funcionário ativo: enviam, veem e removem.
--        - Cliente: só VÊ, e apenas os documentos das licitações que ele já
--          enxerga (a regra de leitura de licitacoes é reaproveitada, então
--          qualquer mudança futura nela vale aqui também).
--
-- Cópias da mesma licitação para várias empresas: cada cópia tem as suas
-- linhas em licitacao_documentos, apontando para o MESMO arquivo no Storage
-- (sem duplicar o arquivo). Por isso a leitura no Storage é liberada pelo
-- caminho registrado na tabela, e não pela pasta.
--
-- Regra "pelo menos 1 arquivo por licitação": é aplicada pelo sistema (tela),
-- não pelo banco, para não bloquear licitações já cadastradas.
--
-- Depende das funções is_admin_ativo() e is_funcionario_ativo() (já existem).
-- Como aplicar: colar no SQL Editor do Supabase e executar (uma vez só).
-- É seguro rodar de novo.

-- 1) Bucket privado ---------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('documentos-edital', 'documentos-edital', false, 52428800)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit;

-- 2) Tabela -----------------------------------------------------------------
create table if not exists public.licitacao_documentos (
  id            uuid primary key default gen_random_uuid(),
  licitacao_id  uuid not null references public.licitacoes(id) on delete cascade,
  nome_arquivo  text not null,
  caminho       text not null,
  tamanho_bytes bigint,
  tipo_mime     text,
  enviado_por   uuid default auth.uid(),
  criado_em     timestamptz not null default now(),
  constraint licitacao_documentos_unico unique (licitacao_id, caminho)
);

create index if not exists licitacao_documentos_licitacao_idx
  on public.licitacao_documentos (licitacao_id);
create index if not exists licitacao_documentos_caminho_idx
  on public.licitacao_documentos (caminho);

alter table public.licitacao_documentos enable row level security;

grant select, insert, delete on public.licitacao_documentos to authenticated;

-- 3) Regras da tabela ---------------------------------------------------------
-- Ver: quem enxerga a licitação enxerga os documentos dela (a consulta a
-- licitacoes já passa pela regra de SELECT dessa tabela).
drop policy if exists "licitacao_documentos_select" on public.licitacao_documentos;
create policy "licitacao_documentos_select"
on public.licitacao_documentos
for select
to authenticated
using (
  exists (select 1 from public.licitacoes l where l.id = licitacao_id)
);

-- Enviar: só equipe ativa, e só em licitação que ela enxerga.
drop policy if exists "licitacao_documentos_insert_equipe" on public.licitacao_documentos;
create policy "licitacao_documentos_insert_equipe"
on public.licitacao_documentos
for insert
to authenticated
with check (
  (is_admin_ativo() or is_funcionario_ativo())
  and exists (select 1 from public.licitacoes l where l.id = licitacao_id)
);

-- Remover: só equipe ativa, e só em licitação que ela enxerga.
drop policy if exists "licitacao_documentos_delete_equipe" on public.licitacao_documentos;
create policy "licitacao_documentos_delete_equipe"
on public.licitacao_documentos
for delete
to authenticated
using (
  (is_admin_ativo() or is_funcionario_ativo())
  and exists (select 1 from public.licitacoes l where l.id = licitacao_id)
);

-- 4) Regras do Storage (bucket "documentos-edital") ------------------------------
-- Enviar arquivo: só equipe ativa.
drop policy if exists "documentos_edital_insert_equipe" on storage.objects;
create policy "documentos_edital_insert_equipe"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'documentos-edital'
  and (is_admin_ativo() or is_funcionario_ativo())
);

-- Ler/baixar: quem enxerga algum registro da tabela que aponte para o arquivo
-- (equipe com acesso à licitação ou cliente da licitação liberada).
drop policy if exists "documentos_edital_select" on storage.objects;
create policy "documentos_edital_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'documentos-edital'
  and exists (
    select 1
    from public.licitacao_documentos d
    where d.caminho = storage.objects.name
  )
);

-- Apagar arquivo: só equipe ativa. O sistema só apaga o arquivo do Storage
-- quando nenhuma licitação (cópia) o usa mais.
drop policy if exists "documentos_edital_delete_equipe" on storage.objects;
create policy "documentos_edital_delete_equipe"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'documentos-edital'
  and (is_admin_ativo() or is_funcionario_ativo())
);

-- Conferência (deve listar o bucket, a tabela e as 6 regras):
-- select id, public, file_size_limit from storage.buckets where id = 'documentos-edital';
-- select policyname, cmd from pg_policies
--  where tablename = 'licitacao_documentos' or policyname like 'documentos_edital%'
--  order by tablename, cmd;
--
-- Para desfazer (apaga os registros dos documentos; os arquivos do Storage
-- precisam ser removidos à parte):
-- drop table if exists public.licitacao_documentos;
-- drop policy if exists "documentos_edital_insert_equipe" on storage.objects;
-- drop policy if exists "documentos_edital_select" on storage.objects;
-- drop policy if exists "documentos_edital_delete_equipe" on storage.objects;
