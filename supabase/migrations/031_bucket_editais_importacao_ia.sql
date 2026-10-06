-- 031_bucket_editais_importacao_ia.sql
--
-- Prepara o Storage para a importação de edital por IA (botão "Importar
-- edital (PDF)" no cadastro de Licitação).
--
-- Fluxo: o navegador do Analista/Admin envia o PDF para o bucket "editais"
-- (pasta "rascunhos/"); a Edge Function extrair-edital-ia lê o arquivo com
-- a service_role key (que ignora RLS) e o APAGA em seguida. Por isso só
-- existe política de INSERT — não há política de leitura nem de exclusão
-- para usuários comuns: ninguém consegue ler PDFs de editais pelo
-- navegador, e a limpeza é feita pela própria function.
--
-- Como aplicar: colar no SQL Editor do Supabase e executar (uma vez só).
-- É seguro rodar de novo — usa "on conflict" e "drop policy if exists".

-- Bucket PRIVADO (public = false), só PDF, limite de 20 MB por arquivo.
-- O limite considera que a API da IA tem teto de tamanho por requisição
-- e o PDF vai codificado em base64 (cresce ~33%) — não aumente sem
-- conferir esse teto.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('editais', 'editais', false, 20971520, array['application/pdf'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Quem pode enviar: só Administrador ativo ou Funcionário ativo (clientes
-- não importam editais), e só dentro da pasta "rascunhos/".
drop policy if exists "editais_insert_equipe" on storage.objects;

create policy "editais_insert_equipe"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'editais'
  and name like 'rascunhos/%'
  and (is_admin_ativo() or is_funcionario_ativo())
);
