-- 012_licitacoes_delete_so_admin.sql
--
-- Restringe a exclusão de licitação a Admin apenas — hoje qualquer
-- Funcionário com acesso àquela licitação (via carteira) também podia
-- apagar o registro inteiro. Excluir é uma ação destrutiva grande demais
-- pra não ser exclusiva do Admin (confirmado com o Márcio).

drop policy if exists "licitacoes_delete" on licitacoes;

create policy "licitacoes_delete"
on licitacoes
for delete
to authenticated
using (is_admin_ativo());
