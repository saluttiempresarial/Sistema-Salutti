import { useEffect, useState } from 'react'
import { DashboardShell } from '@/components/DashboardShell'
import { FuncionarioFilters } from '@/components/funcionarios/FuncionarioFilters'
import { FuncionarioTable } from '@/components/funcionarios/FuncionarioTable'
import { FuncionarioFormModal } from '@/components/funcionarios/FuncionarioFormModal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Pagination } from '@/components/Pagination'
import { useDebounce } from '@/hooks/useDebounce'
import { funcionarioService } from '@/services/funcionarioService'
import type { Funcionario, FuncionarioStatus } from '@/types/funcionario'

const PAGE_SIZE = 5

/** Segue exatamente o mesmo padrão de ClientesPage. */
export function FuncionariosPage() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<FuncionarioStatus | 'todos'>('todos')
  const [page, setPage] = useState(1)
  const buscaAdiada = useDebounce(search)

  const [modalAberto, setModalAberto] = useState(false)
  const [funcionarioEmEdicao, setFuncionarioEmEdicao] = useState<Funcionario | undefined>(undefined)
  const [funcionarioParaExcluir, setFuncionarioParaExcluir] = useState<Funcionario | undefined>(
    undefined
  )
  const [isDeleting, setIsDeleting] = useState(false)

  async function carregarFuncionarios() {
    setIsLoading(true)
    const resultado = await funcionarioService.list({
      search: buscaAdiada,
      status,
      page,
      pageSize: PAGE_SIZE,
    })
    setFuncionarios(resultado.data)
    setTotal(resultado.total)
    setIsLoading(false)
  }

  useEffect(() => {
    carregarFuncionarios()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscaAdiada, status, page])

  // Sempre que a busca ou o filtro mudar, volta para a primeira página.
  useEffect(() => {
    setPage(1)
  }, [buscaAdiada, status])

  function handleNovoFuncionario() {
    setFuncionarioEmEdicao(undefined)
    setModalAberto(true)
  }

  function handleEditar(funcionario: Funcionario) {
    setFuncionarioEmEdicao(funcionario)
    setModalAberto(true)
  }

  function handleFecharModal() {
    setModalAberto(false)
    setFuncionarioEmEdicao(undefined)
  }

  function handleSalvo() {
    setModalAberto(false)
    setFuncionarioEmEdicao(undefined)
    carregarFuncionarios()
  }

  async function handleConfirmarExclusao() {
    if (!funcionarioParaExcluir) return
    setIsDeleting(true)
    await funcionarioService.remove(funcionarioParaExcluir.id)
    setIsDeleting(false)
    setFuncionarioParaExcluir(undefined)
    carregarFuncionarios()
  }

  return (
    <DashboardShell
      title="Cadastro de Funcionários"
      subtitle="Gerencie os funcionários com acesso ao sistema."
      showHeader={false}
    >
      <div className="rounded-xl border border-ink-soft/10 bg-white p-5 shadow-soft">
        <FuncionarioFilters
          search={search}
          onSearchChange={setSearch}
          status={status}
          onStatusChange={setStatus}
          onNovoFuncionario={handleNovoFuncionario}
        />

        <div className="mt-5">
          <FuncionarioTable
            funcionarios={funcionarios}
            isLoading={isLoading}
            onEdit={handleEditar}
            onDelete={setFuncionarioParaExcluir}
          />
        </div>

        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      </div>

      <FuncionarioFormModal
        key={funcionarioEmEdicao?.id ?? 'novo'}
        open={modalAberto}
        funcionarioEmEdicao={funcionarioEmEdicao}
        onClose={handleFecharModal}
        onSaved={handleSalvo}
      />

      <ConfirmDialog
        open={Boolean(funcionarioParaExcluir)}
        title="Excluir funcionário"
        description={
          funcionarioParaExcluir
            ? `Tem certeza que deseja excluir "${funcionarioParaExcluir.pessoal.nomeCompleto}"? Esta ação não pode ser desfeita.`
            : ''
        }
        confirmLabel="Excluir"
        isLoading={isDeleting}
        onConfirm={handleConfirmarExclusao}
        onCancel={() => setFuncionarioParaExcluir(undefined)}
      />
    </DashboardShell>
  )
}
