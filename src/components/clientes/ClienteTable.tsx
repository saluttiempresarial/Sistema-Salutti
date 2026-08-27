import type { Cliente } from '@/types/cliente'
import { StatusBadge } from '@/components/StatusBadge'

interface ClienteTableProps {
  clientes: Cliente[]
  isLoading: boolean
  onEdit: (cliente: Cliente) => void
  onDelete: (cliente: Cliente) => void
}

export function ClienteTable({ clientes, isLoading, onEdit, onDelete }: ClienteTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="font-body text-sm text-ink-soft">Carregando clientes…</p>
      </div>
    )
  }

  if (clientes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 py-16 text-center">
        <p className="font-body text-sm font-medium text-ink">Nenhum cliente encontrado.</p>
        <p className="font-body text-xs text-ink-soft">
          Ajuste a busca ou o filtro de status, ou cadastre um novo cliente.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left">
        <thead>
          <tr className="border-b border-ink-soft/10">
            <th className="whitespace-nowrap px-3 py-3 font-mono text-xs uppercase tracking-wide text-ink-soft">
              Razão Social
            </th>
            <th className="whitespace-nowrap px-3 py-3 font-mono text-xs uppercase tracking-wide text-ink-soft">
              Nome Fantasia
            </th>
            <th className="whitespace-nowrap px-3 py-3 font-mono text-xs uppercase tracking-wide text-ink-soft">
              CNPJ
            </th>
            <th className="whitespace-nowrap px-3 py-3 font-mono text-xs uppercase tracking-wide text-ink-soft">
              Segmento
            </th>
            <th className="whitespace-nowrap px-3 py-3 font-mono text-xs uppercase tracking-wide text-ink-soft">
              Status
            </th>
            <th className="whitespace-nowrap px-3 py-3 font-mono text-xs uppercase tracking-wide text-ink-soft">
              Ações
            </th>
          </tr>
        </thead>
        <tbody>
          {clientes.map((cliente) => (
            <tr key={cliente.id} className="border-b border-ink-soft/5 last:border-0 hover:bg-forest-mist/20">
              <td className="px-3 py-3 font-body text-sm font-medium text-ink">
                {cliente.empresa.razaoSocial}
              </td>
              <td className="px-3 py-3 font-body text-sm text-ink-soft">
                {cliente.empresa.nomeFantasia}
              </td>
              <td className="px-3 py-3 font-mono text-xs text-ink-soft">{cliente.empresa.cnpj}</td>
              <td className="px-3 py-3 font-body text-sm text-ink-soft">{cliente.empresa.segmento}</td>
              <td className="px-3 py-3">
                <StatusBadge status={cliente.status} />
              </td>
              <td className="px-3 py-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onEdit(cliente)}
                    className="font-body text-sm font-medium text-forest-deep hover:underline"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(cliente)}
                    className="font-body text-sm font-medium text-red-600 hover:underline"
                  >
                    Excluir
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
