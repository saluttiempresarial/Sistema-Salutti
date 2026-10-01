-- 005_porte_empresa.sql
--
-- Adiciona o campo "Porte da empresa" (ME/EPP ou Demais) à tabela
-- `clientes`. Usado para bloquear o envio de propostas para clientes
-- ME/EPP (regra de negócio da Salutti — ver comentário em types/cliente.ts).
--
-- Clientes já cadastrados recebem 'demais' por padrão; ajuste manualmente
-- no Supabase (Table Editor) os que já são conhecidos como ME/EPP.

alter table clientes
  add column if not exists porte text not null default 'demais'
  check (porte in ('me_epp', 'demais'));
