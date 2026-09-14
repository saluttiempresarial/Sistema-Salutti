import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import type { Funcionario } from '@/types/funcionario'
import { funcionarioParaFormData } from '@/types/funcionario'
import { Modal } from '@/components/Modal'
import { Button } from '@/components/Button'
import { Tabs } from '@/components/Tabs'
import type { TabItem } from '@/components/Tabs'
import { useFuncionarioForm } from '@/hooks/useFuncionarioForm'
import { funcionarioService } from '@/services/funcionarioService'
import { DadosPessoaisTab } from '@/components/funcionarios/tabs/DadosPessoaisTab'
import { CargoTab } from '@/components/funcionarios/tabs/CargoTab'
import { AcessoTab } from '@/components/funcionarios/tabs/AcessoTab'
import { PermissoesTab } from '@/components/funcionarios/tabs/PermissoesTab'
import { HistoricoTab } from '@/components/funcionarios/tabs/HistoricoTab'

interface FuncionarioFormModalProps {
  open: boolean
  /** Funcionário em edição; undefined = criação de um novo funcionário. */
  funcionarioEmEdicao?: Funcionario
  onClose: () => void
  onSaved: () => void
}

const TAB_IDS = ['pessoal', 'cargo', 'acesso', 'permissoes', 'historico'] as const
type TabId = (typeof TAB_IDS)[number]

const CAMPOS_POR_ABA: Record<TabId, string[]> = {
  pessoal: ['nomeCompleto', 'cpf', 'dataNascimento', 'whatsapp', 'email'],
  cargo: ['cargo', 'departamento', 'dataAdmissao'],
  acesso: ['emailLogin', 'senhaTemporaria', 'confirmarSenha'],
  permissoes: [],
  historico: [],
}

/** Segue exatamente o mesmo padrão de ClienteFormModal. */
export function FuncionarioFormModal({
  open,
  funcionarioEmEdicao,
  onClose,
  onSaved,
}: FuncionarioFormModalProps) {
  const { user } = useAuth()
  const isEdicao = Boolean(funcionarioEmEdicao)
  const [activeTab, setActiveTab] = useState<TabId>('pessoal')
  const [isSaving, setIsSaving] = useState(false)
  const [erroGeral, setErroGeral] = useState('')

  const {
    formData,
    errors,
    updatePessoal,
    updateCargo,
    updateAcesso,
    updateSenha,
    updatePermissoes,
    updateObservacoesAdministrativas,
    clearError,
    validar,
  } = useFuncionarioForm(
    funcionarioEmEdicao ? funcionarioParaFormData(funcionarioEmEdicao) : undefined,
    { funcionarioIdEmEdicao: funcionarioEmEdicao?.id, isEdicao }
  )

  const tabs: TabItem[] = [
    { id: 'pessoal', label: 'Dados Pessoais', hasError: CAMPOS_POR_ABA.pessoal.some((c) => c in errors) },
    { id: 'cargo', label: 'Cargo', hasError: CAMPOS_POR_ABA.cargo.some((c) => c in errors) },
    { id: 'acesso', label: 'Acesso ao Sistema', hasError: CAMPOS_POR_ABA.acesso.some((c) => c in errors) },
    { id: 'permissoes', label: 'Permissões' },
    { id: 'historico', label: 'Histórico' },
  ]

  async function handleSalvar() {
    setErroGeral('')
    const valido = await validar()
    if (!valido) {
      // Leva o usuário até a primeira aba com pendências.
      const primeiraAbaComErro = TAB_IDS.find((tab) =>
        CAMPOS_POR_ABA[tab].some((campo) => campo in errors)
      )
      if (primeiraAbaComErro) setActiveTab(primeiraAbaComErro)
      return
    }

    setIsSaving(true)
    try {
      if (funcionarioEmEdicao) {
        await funcionarioService.update(funcionarioEmEdicao.id, formData, user?.name ?? 'Desconhecido')
      } else {
        await funcionarioService.create(formData, user?.name ?? 'Desconhecido')
      }
      onSaved()
    } catch (err) {
      setErroGeral(err instanceof Error ? err.message : 'Não foi possível salvar o funcionário.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdicao ? 'Editar Funcionário' : 'Novo Funcionário'}
      subtitle={
        isEdicao
          ? funcionarioEmEdicao?.pessoal.nomeCompleto
          : 'Preencha as abas abaixo para cadastrar o funcionário.'
      }
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={isSaving}>
            {isSaving ? 'Salvando…' : 'Salvar Funcionário'}
          </Button>
        </>
      }
    >
      <Tabs tabs={tabs} activeTab={activeTab} onChange={(id) => setActiveTab(id as TabId)} />

      <div className="pt-5">
        {erroGeral && (
          <p className="mb-4 rounded-lg bg-red-50 px-3.5 py-2.5 font-body text-sm text-red-600">
            {erroGeral}
          </p>
        )}

        {activeTab === 'pessoal' && (
          <DadosPessoaisTab
            pessoal={formData.pessoal}
            errors={errors}
            onChange={updatePessoal}
            onClearError={clearError}
          />
        )}
        {activeTab === 'cargo' && (
          <CargoTab
            cargo={formData.cargo}
            errors={errors}
            onChange={updateCargo}
            onClearError={clearError}
          />
        )}
        {activeTab === 'acesso' && (
          <AcessoTab
            acesso={formData.acesso}
            senhaTemporaria={formData.senhaTemporaria}
            confirmarSenha={formData.confirmarSenha}
            errors={errors}
            isEdicao={isEdicao}
            onChangeAcesso={updateAcesso}
            onChangeSenha={updateSenha}
            onClearError={clearError}
          />
        )}
        {activeTab === 'permissoes' && (
          <PermissoesTab
            permissoes={formData.permissoes}
            perfil={formData.acesso.perfil}
            onChange={updatePermissoes}
          />
        )}
        {activeTab === 'historico' && (
          <HistoricoTab
            observacoesAdministrativas={formData.observacoesAdministrativas}
            historico={funcionarioEmEdicao?.historico ?? []}
            onChange={updateObservacoesAdministrativas}
          />
        )}
      </div>
    </Modal>
  )
}
