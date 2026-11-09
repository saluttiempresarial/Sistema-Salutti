-- supabase/migrations/065_marca_vencedora_disputa.sql
--
-- Disputas: novo campo "Marca vencedora" por item/grupo (ao lado da empresa
-- vencedora). Só preenchido quando o resultado do cliente é de perda.
--
-- ORDEM: rode esta migração ANTES de publicar os arquivos novos do sistema.
-- Sem a coluna, salvar a disputa falha.
--
-- Para desfazer:
--   alter table public.disputa_itens drop column if exists marca_vencedora;

alter table public.disputa_itens add column if not exists marca_vencedora text;
