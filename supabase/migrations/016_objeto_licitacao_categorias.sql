-- 016_objeto_licitacao_categorias.sql
--
-- "Objeto da licitação" deixou de ser texto livre e virou uma categoria
-- fixa (Produto / Serviços / Obra / Serviços Técnicos). Limpa qualquer
-- texto livre já cadastrado antes de travar a regra, senão a constraint
-- falha em cima do dado antigo (mesmo cuidado de 015).

update licitacoes set objeto = null
  where objeto is not null
  and objeto not in ('Produto', 'Serviços', 'Obra', 'Serviços Técnicos');

alter table licitacoes add constraint licitacoes_objeto_check
  check (objeto is null or objeto = any (array['Produto', 'Serviços', 'Obra', 'Serviços Técnicos']::text[]));
