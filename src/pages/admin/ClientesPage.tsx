import { useEffect, useState } from 'react'
import { DashboardShell } from '@/components/DashboardShell'
import { ClienteFilters } from '@/components/clientes/ClienteFilters'
import { ClienteTable } from '@/components/clientes/ClienteTable'
import { ClienteFormModal } from '@/components/clientes/ClienteFormModal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Pagination } from '@/components/Pagination'
import { useDebounce } from '@/hooks/useDebounce'
import { clienteService } from '@/services/clienteService'
import type { Cliente, ClienteStatus } from '@/types/cliente'

const PAGE_SIZE = 5

export function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<ClienteStatus | 'todos'>('todos')
  const [page, setPage] = useState(1)
  const buscaAdiada = useDebounce(search)

  const [modalAberto, setModalAberto] = useState(false)
  const [clienteEmEdicao, setClienteEmEdicao] = useState<Cliente | undefined>(undefined)
  const [clienteParaExcluir, setClienteParaExcluir] = useState<Cliente | undefined>(undefined)
  const [isDeleting, setIsDeleting] = useState(false)

  async function carregarClientes() {
    setIsLoading(true)
    const resultado = await clienteService.list({
      search: buscaAdiada,
      status,
      page,
      pageSize: PAGE_SIZE,
    })
    setClientes(resultado.data)
    setTotal(resultado.total)
    setIsLoading(false)
  }

  useEffect(() => {
    carregarClientes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscaAdiada, status, page])

  // Sempre que a busca ou o filtro mudar, volta para a primeira página.
  useEffect(() => {
    setPage(1)
  }, [buscaAdiada, status])

  function handleNovoCliente() {
    setClienteEmEdicao(undefined)
    setModalAberto(true)
  }

  function handleEditar(cliente: Cliente) {
    setClienteEmEdicao(cliente)
    setModalAberto(true)
  }

  function handleFecharModal() {
    setModalAberto(false)
    setClienteEmEdicao(undefined)
  }

  function handleSalvo() {
    setModalAberto(false)
    setClienteEmEdicao(undefined)
    carregarClientes()
  }

  async function handleConfirmarExclusao() {
    if (!clienteParaExcluir) return
    setIsDeleting(true)
    await clienteService.remove(clienteParaExcluir.id)
    setIsDeleting(false)
    setClienteParaExcluir(undefined)
    carregarClientes()
  }

  return (
    <DashboardShell
      title="Cadastro de Clientes"
      subtitle="Gerencie as empresas clientes com acesso ao sistema."
    >
      <div className="rounded-xl border border-ink-soft/10 bg-white p-5 shadow-soft">
        <ClienteFilters
          search={search}
          onSearchChange={setSearch}
          status={status}
          onStatusChange={setStatus}
          onNovoCliente={handleNovoCliente}
        />

        <div className="mt-5">
          <ClienteTable
            clientes={clientes}
            isLoading={isLoading}
            onEdit={handleEditar}
            onDelete={setClienteParaExcluir}
          />
        </div>

        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      </div>

      <ClienteFormModal
        key={clienteEmEdicao?.id ?? 'novo'}
        open={modalAberto}
        clienteEmEdicao={clienteEmEdicao}
        onClose={handleFecharModal}
        onSaved={handleSalvo}
      />

      <ConfirmDialog
        open={Boolean(clienteParaExcluir)}
        title="Excluir cliente"
        description={
          clienteParaExcluir
            ? `Tem certeza que deseja excluir "${clienteParaExcluir.empresa.razaoSocial}"? Esta ação não pode ser desfeita.`
            : ''
        }
        confirmLabel="Excluir"
        isLoading={isDeleting}
        onConfirm={handleConfirmarExclusao}
        onCancel={() => setClienteParaExcluir(undefined)}
      />
    </DashboardShell>
  )
}
