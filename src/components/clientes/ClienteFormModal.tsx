import { useState } from 'react'
import type { Cliente } from '@/types/cliente'
import { clienteParaFormData } from '@/types/cliente'
import { Modal } from '@/components/Modal'
import { Button } from '@/components/Button'
import { Tabs } from '@/components/Tabs'
import type { TabItem } from '@/components/Tabs'
import { useClienteForm } from '@/hooks/useClienteForm'
import { clienteService } from '@/services/clienteService'
import { DadosEmpresaTab } from '@/components/clientes/tabs/DadosEmpresaTab'
import { EnderecoTab } from '@/components/clientes/tabs/EnderecoTab'
import { ContatoTab } from '@/components/clientes/tabs/ContatoTab'
import { UsuariosClienteTab } from '@/components/clientes/tabs/UsuariosClienteTab'
import { ObservacoesTab } from '@/components/clientes/tabs/ObservacoesTab'

interface ClienteFormModalProps {
  open: boolean
  /** Cliente em edição; undefined = criação de um novo cliente. */
  clienteEmEdicao?: Cliente
  onClose: () => void
  onSaved: () => void
}

const TAB_IDS = ['empresa', 'endereco', 'contato', 'usuarios', 'observacoes'] as const
type TabId = (typeof TAB_IDS)[number]

const CAMPOS_POR_ABA: Record<TabId, string[]> = {
  empresa: ['razaoSocial', 'nomeFantasia', 'cnpj', 'segmento'],
  endereco: ['cep', 'endereco', 'numero', 'bairro', 'cidade', 'estado'],
  contato: ['responsavel', 'cargo', 'whatsapp', 'email'],
  usuarios: [],
  observacoes: [],
}

export function ClienteFormModal({ open, clienteEmEdicao, onClose, onSaved }: ClienteFormModalProps) {
  const isEdicao = Boolean(clienteEmEdicao)
  const [activeTab, setActiveTab] = useState<TabId>('empresa')
  const [isSaving, setIsSaving] = useState(false)
  const [erroGeral, setErroGeral] = useState('')
  // Guarda o id assim que o cliente é criado, para a aba "Usuários" liberar
  // mesmo sem fechar/reabrir o modal (criar → já poder cadastrar usuários).
  const [clienteIdSalvo, setClienteIdSalvo] = useState<string | undefined>(clienteEmEdicao?.id)

  const {
    formData,
    errors,
    updateEmpresa,
    updateEndereco,
    updateContato,
    updateStatus,
    updateObservacoes,
    clearError,
    validar,
  } = useClienteForm(clienteEmEdicao ? clienteParaFormData(clienteEmEdicao) : undefined, {
    clienteIdEmEdicao: clienteEmEdicao?.id,
  })

  const tabs: TabItem[] = [
    { id: 'empresa', label: 'Dados da Empresa', hasError: CAMPOS_POR_ABA.empresa.some((c) => c in errors) },
    { id: 'endereco', label: 'Endereço', hasError: CAMPOS_POR_ABA.endereco.some((c) => c in errors) },
    { id: 'contato', label: 'Contato', hasError: CAMPOS_POR_ABA.contato.some((c) => c in errors) },
    { id: 'usuarios', label: 'Usuários' },
    { id: 'observacoes', label: 'Observações' },
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
      if (clienteEmEdicao) {
        await clienteService.update(clienteEmEdicao.id, formData)
      } else {
        const criado = await clienteService.create(formData)
        setClienteIdSalvo(criado.id)
      }
      onSaved()
    } catch (err) {
      setErroGeral(err instanceof Error ? err.message : 'Não foi possível salvar o cliente.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdicao ? 'Editar Cliente' : 'Novo Cliente'}
      subtitle={isEdicao ? clienteEmEdicao?.empresa.razaoSocial : 'Preencha as abas abaixo para cadastrar o cliente.'}
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={isSaving}>
            {isSaving ? 'Salvando…' : 'Salvar Cliente'}
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

        {activeTab === 'empresa' && (
          <DadosEmpresaTab
            empresa={formData.empresa}
            status={formData.status}
            errors={errors}
            onChange={updateEmpresa}
            onChangeStatus={updateStatus}
            onClearError={clearError}
          />
        )}
        {activeTab === 'endereco' && (
          <EnderecoTab
            endereco={formData.endereco}
            errors={errors}
            onChange={updateEndereco}
            onClearError={clearError}
          />
        )}
        {activeTab === 'contato' && (
          <ContatoTab
            contato={formData.contato}
            errors={errors}
            onChange={updateContato}
            onClearError={clearError}
          />
        )}
        {activeTab === 'usuarios' && <UsuariosClienteTab clienteId={clienteIdSalvo} />}
        {activeTab === 'observacoes' && (
          <ObservacoesTab observacoes={formData.observacoes} onChange={updateObservacoes} />
        )}
      </div>
    </Modal>
  )
}
