-- 011_foto_propria_funcionario.sql
--
-- Documentação retroativa: essa função já existe no banco de produção
-- (confirmado via pg_get_functiondef), mas o arquivo de migração nunca
-- tinha sido salvo no repositório — o código em funcionarioService.ts já
-- citava "009_foto_propria_funcionario.sql" num comentário, mas o
-- arquivo não existia aqui. Recriando com esse número novo (011) só para
-- ficar documentado e rastreável junto com as demais migrações — NÃO
-- precisa ser rodada de novo no Supabase, já está aplicada.
--
-- O que faz: permite que o próprio Funcionário logado atualize SÓ o
-- campo foto_url do seu cadastro — nada mais (a política
-- funcionarios_update continua exigindo Admin para qualquer outro
-- campo). SECURITY DEFINER + filtro por auth.uid() garante que só dá
-- pra mexer na própria linha, nunca na de outro funcionário.

create or replace function public.atualizar_foto_propria(nova_url text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update funcionarios
  set foto_url = nova_url
  where auth_user_id = auth.uid();
end;
$function$;
