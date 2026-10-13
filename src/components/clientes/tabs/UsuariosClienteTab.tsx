import { useEffect, useState } from 'react'
import { TextField } from '@/components/TextField'
import { SelectField } from '@/components/SelectField'
import { Button } from '@/components/Button'
import { StatusBadge } from '@/components/StatusBadge'
import { usuarioClienteService } from '@/services/usuarioClienteService'
import { isValidEmail } from '@/utils/validators'
import type { UsuarioCliente, UsuarioClienteFormData } from '@/types/usuarioCliente'
import { criarUsuarioClienteFormVazio, USUARIO_CLIENTE_PERFIL_LABEL } from '@/types/usuarioCliente'

interface UsuariosClienteTabProps {
  /** undefined = cliente ainda não foi salvo (criação em andamento). */
  clienteId?: string
}

const PERFIL_OPTIONS = [
  { value: 'operador', label: 'Operador' },
  { value: 'gestor', label: 'Gestor' },
]

const STATUS_OPTIONS = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'inativo', label: 'Inativo' },
]

/**
 * Lista os usuários (gestor/operador) do cliente, com um formulário simples
 * pra adicionar ou editar. Substitui a antiga aba "Acesso ao Sistema" —
 * agora um cliente pode ter vários logins, não só um (spec 2.3).
 *
 * NOTA: só funciona depois que o cliente já foi salvo (precisa do id dele
 * pra vincular os usuários) — por isso o aviso quando `clienteId` é undefined.
 */
export function UsuariosClienteTab({ clienteId }: UsuariosClienteTabProps) {
  const [usuarios, setUsuarios] = useState<UsuarioCliente[]>([])
  const [carregando, setCarregando] = useState(true)
  const [formAberto, setFormAberto] = useState(false)
  const [usuarioEmEdicao, setUsuarioEmEdicao] = useState<UsuarioCliente | null>(null)
  const [formData, setFormData] = useState<UsuarioClienteFormData>(criarUsuarioClienteFormVazio())
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function carregar() {
    if (!clienteId) return
    setCarregando(true)
    const lista = await usuarioClienteService.listarPorCliente(clienteId)
    setUsuarios(lista)
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId])

  function abrirNovo() {
    setUsuarioEmEdicao(null)
    setFormData(criarUsuarioClienteFormVazio())
    setErro('')
    setFormAberto(true)
  }

  function abrirEdicao(usuario: UsuarioCliente) {
    setUsuarioEmEdicao(usuario)
    setFormData({
      nome: usuario.nome,
      email: usuario.email,
      cargo: usuario.cargo,
      whatsapp: usuario.whatsapp,
      telefone: usuario.telefone,
      perfil: usuario.perfil,
      status: usuario.status,
      senhaTemporaria: '',
      confirmarSenha: '',
    })
    setErro('')
    setFormAberto(true)
  }

  async function handleSalvar() {
    if (!clienteId) return
    setErro('')

    if (!formData.nome.trim() || !formData.email.trim()) {
      setErro('Nome e e-mail são obrigatórios.')
      return
    }
    if (!isValidEmail(formData.email)) {
      setErro('E-mail inválido.')
      return
    }
    // Senha temporária: obrigatória ao criar (sem ela não existe login); ao
    // editar, só é validada se o Administrador preencher algum dos campos.
    const senhaPreenchida = formData.senhaTemporaria !== '' || formData.confirmarSenha !== ''
    if (!usuarioEmEdicao || senhaPreenchida) {
      if (!formData.senhaTemporaria) {
        setErro('Informe a senha temporária do usuário.')
        return
      }
      if (formData.senhaTemporaria.length < 6) {
        setErro('A senha precisa ter no mínimo 6 caracteres.')
        return
      }
      if (formData.confirmarSenha !== formData.senhaTemporaria) {
        setErro('A confirmação da senha não confere.')
        return
      }
    }

    const duplicado = await usuarioClienteService.emailJaCadastrado(
      formData.email,
      usuarioEmEdicao?.id
    )
    if (duplicado) {
      setErro('Já existe um usuário com este e-mail.')
      return
    }

    setSalvando(true)
    try {
      if (usuarioEmEdicao) {
        await usuarioClienteService.update(usuarioEmEdicao.id, formData)
      } else {
        await usuarioClienteService.create(clienteId, formData)
      }
      setFormAberto(false)
      await carregar()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível salvar o usuário.')
    } finally {
      setSalvando(false)
    }
  }

  async function handleExcluir(usuario: UsuarioCliente) {
    if (!confirm(`Remover o acesso de "${usuario.nome}"?`)) return
    await usuarioClienteService.remove(usuario.id)
    await carregar()
  }

  if (!clienteId) {
    return (
      <div className="rounded-lg border border-dashed border-ink-soft/25 bg-paper-2/60 p-4">
        <p className="font-body text-sm text-ink-soft">
          Salve os dados da empresa primeiro (aba "Dados da Empresa") — depois disso, volte
          aqui para cadastrar os usuários (gestor e operadores) que vão acessar o Portal do
          Cliente.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <p className="font-body text-sm text-ink-soft">
          Gestor tem acesso total aos dados do cliente e pode gerenciar os operadores.
        </p>
        <Button type="button" onClick={abrirNovo}>
          + Novo usuário
        </Button>
      </div>

      {carregando && <p className="font-body text-sm text-ink-soft">Carregando...</p>}

      {!carregando && usuarios.length === 0 && !formAberto && (
        <p className="rounded-lg border border-dashed border-ink-soft/25 bg-paper-2/60 p-4 font-body text-sm text-ink-soft">
          Nenhum usuário cadastrado ainda para este cliente.
        </p>
      )}

      {!carregando && usuarios.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-ink-soft/15">
          <table className="w-full font-body text-sm">
            <thead className="bg-paper-2 text-left text-xs uppercase tracking-wide text-ink-soft">
              <tr>
                <th className="px-3 py-2">Nome</th>
                <th className="px-3 py-2">E-mail</th>
                <th className="px-3 py-2">Perfil</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-3/10">
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td className="px-3 py-2 text-ink">{u.nome}</td>
                  <td className="px-3 py-2 text-ink-soft">{u.email}</td>
                  <td className="px-3 py-2 text-ink-soft">{USUARIO_CLIENTE_PERFIL_LABEL[u.perfil]}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={u.status} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => abrirEdicao(u)}
                      className="mr-3 text-forest-deep hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExcluir(u)}
                      className="text-red-600 hover:underline"
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formAberto && (
        <div className="rounded-lg border border-ink-soft/15 bg-paper-2/40 p-4">
          <p className="mb-3 font-body text-sm font-medium text-ink">
            {usuarioEmEdicao ? 'Editar usuário' : 'Novo usuário'}
          </p>

          {erro && (
            <p className="mb-3 rounded-lg bg-red-50 px-3.5 py-2.5 font-body text-sm text-red-600">
              {erro}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Nome *"
              value={formData.nome}
              onChange={(e) => setFormData((p) => ({ ...p, nome: e.target.value }))}
            />
            <TextField
              label="E-mail *"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
            />
            <TextField
              label="Cargo"
              value={formData.cargo}
              onChange={(e) => setFormData((p) => ({ ...p, cargo: e.target.value }))}
            />
            <TextField
              label="WhatsApp"
              value={formData.whatsapp}
              onChange={(e) => setFormData((p) => ({ ...p, whatsapp: e.target.value }))}
            />
            <SelectField
              label="Perfil *"
              value={formData.perfil}
              options={PERFIL_OPTIONS}
              onChange={(e) =>
                setFormData((p) => ({ ...p, perfil: e.target.value as UsuarioClienteFormData['perfil'] }))
              }
            />
            <SelectField
              label="Status *"
              value={formData.status}
              options={STATUS_OPTIONS}
              onChange={(e) =>
                setFormData((p) => ({ ...p, status: e.target.value as UsuarioClienteFormData['status'] }))
              }
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <TextField
              label={usuarioEmEdicao ? 'Nova senha (deixe em branco para manter a atual)' : 'Senha temporária *'}
              type="password"
              autoComplete="new-password"
              value={formData.senhaTemporaria}
              onChange={(e) => setFormData((p) => ({ ...p, senhaTemporaria: e.target.value }))}
            />
            <TextField
              label={usuarioEmEdicao ? 'Confirmar nova senha' : 'Confirmar senha *'}
              type="password"
              autoComplete="new-password"
              value={formData.confirmarSenha}
              onChange={(e) => setFormData((p) => ({ ...p, confirmarSenha: e.target.value }))}
            />
          </div>

          <p className="mt-3 font-body text-xs text-ink-soft">
            O usuário entra com o e-mail acima e esta senha. Informe a senha a ele por um canal
            seguro. Mínimo de 6 caracteres.
          </p>

          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setFormAberto(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSalvar} disabled={salvando}>
              {salvando ? 'Salvando…' : 'Salvar usuário'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
