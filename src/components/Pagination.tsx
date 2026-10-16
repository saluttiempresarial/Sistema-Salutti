interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  /** Nome do item no rodapé ("Mostrando 1–4 de 4 ..."). Padrão: cliente/clientes,
   *  para não mudar as telas que já usam este componente. */
  itemSingular?: string
  itemPlural?: string
}

/** Paginação genérica de tabelas — puramente controlada (o dado paginado
 *  vem do service; este componente só calcula/mostra o total de páginas). */
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  itemSingular = 'cliente',
  itemPlural = 'clientes',
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const inicio = total === 0 ? 0 : (page - 1) * pageSize + 1
  const fim = Math.min(page * pageSize, total)

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-ink-soft/10 px-1 py-4 sm:flex-row">
      <p className="font-body text-xs text-ink-soft">
        {total === 0
          ? 'Nenhum resultado encontrado.'
          : `Mostrando ${inicio}–${fim} de ${total} ${total === 1 ? itemSingular : itemPlural}`}
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded-lg border border-ink-soft/20 px-3 py-1.5 font-body text-xs font-medium text-ink-soft transition-colors hover:bg-forest-mist hover:text-forest-deep disabled:cursor-not-allowed disabled:opacity-40"
        >
          Anterior
        </button>
        <span className="font-mono text-xs text-ink-soft">
          Página {page} de {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="rounded-lg border border-ink-soft/20 px-3 py-1.5 font-body text-xs font-medium text-ink-soft transition-colors hover:bg-forest-mist hover:text-forest-deep disabled:cursor-not-allowed disabled:opacity-40"
        >
          Próxima
        </button>
      </div>
    </div>
  )
}
