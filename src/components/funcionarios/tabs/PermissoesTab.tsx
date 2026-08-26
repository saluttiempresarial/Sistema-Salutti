import { useEffect, useState } from 'react'
import type { AcaoPermissao, FuncionarioPerfil, FuncionarioPermissoes, ModuloPermissao } from '@/types/funcionario'
import { MODO_ACESSO_LABEL, MODULO_PERMISSAO_LABEL } from '@/types/funcionario'
import { clienteService } from '@/services/clienteService'
import { mockLicitacoes } from '@/data/mockLicitacoes'
// NOTA: "Licitações atribuídas à parte" ainda usa mockLicitacoes — a
// migração desse módulo específico para o Supabase fica para depois,
// fora do escopo desta correção (só o mock de clientes foi trocado aqui).

interface PermissoesTabProps {
  permissoes: FuncionarioPermissoes
  perfil: FuncionarioPerfil
  onChange: (patch: Partial<FuncionarioPermissoes>) => void
}

interface ClienteResumo {
  id: string
  nomeFantasia: string
}

const MODULOS: ModuloPermissao[] = [
  'clientes',
  'funcionarios',
  'licitacoes',
  'disputas',
  'relatorios',
  'configuracoes',
]

function alternarItem(lista: string[], id: string): string[] {
  return lista.includes(id) ? lista.filter((item) => item !== id) : [...lista, id]
}

function alternarAcao(acoes: AcaoPermissao[], acao: AcaoPermissao): AcaoPermissao[] {
  if (acoes.includes(acao)) {
    // Remover 'visualizar' também remove 'editar' (não faz sentido editar
    // sem poder ver); remover 'editar' mantém 'visualizar'.
    if (acao === 'visualizar') return []
    return acoes.filter((a) => a !== acao)
  }
  // Marcar 'editar' implica marcar 'visualizar' junto.
  if (acao === 'editar') return ['visualizar', 'editar']
  return [...acoes, acao]
}

/** Aba 4 — modo de acesso (total/restrito à carteira), vínculos de
 *  clientes/licitações (só relevantes em modo restrito) e permissões por
 *  módulo/ação. Perfil Administrador ignora tudo aqui (acesso total
 *  garantido pelo perfil), então a aba fica desabilitada com um aviso. */
export function PermissoesTab({ permissoes, perfil, onChange }: PermissoesTabProps) {
  const [clientes, setClientes] = useState<ClienteResumo[]>([])

  useEffect(() => {
    if (perfil === 'admin') return
    let ativo = true
    // 200 cobre a carteira inteira sem precisar de paginação aqui — mesmo
    // padrão já usado no seletor "Cliente vinculado" do LicitacaoFormModal.
    clienteService.list({ page: 1, pageSize: 200 }).then((resultado) => {
      if (!ativo) return
      setClientes(resultado.data.map((c) => ({ id: c.id, nomeFantasia: c.empresa.nomeFantasia })))
    })
    return () => {
      ativo = false
    }
  }, [perfil])

  if (perfil === 'admin') {
    return (
      <div className="rounded-lg border border-dashed border-ink-soft/25 bg-paper-2/60 p-4">
        <p className="font-body text-sm font-medium text-ink-soft">Perfil Administrador</p>
        <p className="mt-1 font-body text-xs text-ink-soft">
          Administradores têm acesso total a todos os módulos e a toda a carteira de clientes,
          independentemente das permissões configuradas aqui. Para restringir o acesso, altere o
          perfil para "Funcionário" na aba "Acesso ao Sistema".
        </p>
      </div>
    )
  }

  function alternarModulo(modulo: ModuloPermissao, acao: AcaoPermissao) {
    onChange({
      modulos: {
        ...permissoes.modulos,
        [modulo]: alternarAcao(permissoes.modulos[modulo], acao),
      },
    })
  }

  const restrito = permissoes.modoAcesso === 'restrito'

  return (
    <div className="grid gap-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Acesso à carteira</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:gap-4">
          {(['total', 'restrito'] as const).map((modo) => (
            <label
              key={modo}
              className="flex flex-1 cursor-pointer items-start gap-2.5 rounded-lg border border-ink-soft/15 p-3 hover:bg-forest-mist/40"
            >
              <input
                type="radio"
                name="modoAcesso"
                checked={permissoes.modoAcesso === modo}
                onChange={() => onChange({ modoAcesso: modo })}
                className="mt-0.5 h-4 w-4 border-ink-soft/40 text-forest focus:ring-forest-mist"
              />
              <span className="font-body text-sm text-ink">{MODO_ACESSO_LABEL[modo]}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Permissões por módulo</p>
        <div className="mt-2 overflow-hidden rounded-lg border border-ink-soft/15">
          <table className="w-full font-body text-sm">
            <thead className="bg-paper-2 text-left text-xs uppercase tracking-wide text-ink-soft">
              <tr>
                <th className="px-3 py-2">Módulo</th>
                <th className="px-3 py-2 text-center">Visualizar</th>
                <th className="px-3 py-2 text-center">Editar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-3/10">
              {MODULOS.map((modulo) => {
                const acoes = permissoes.modulos[modulo]
                return (
                  <tr key={modulo}>
                    <td className="px-3 py-2 text-ink">{MODULO_PERMISSAO_LABEL[modulo]}</td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={acoes.includes('visualizar') || acoes.includes('editar')}
                        onChange={() => alternarModulo(modulo, 'visualizar')}
                        className="h-4 w-4 rounded border-ink-soft/40 text-forest focus:ring-forest-mist"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={acoes.includes('editar')}
                        onChange={() => alternarModulo(modulo, 'editar')}
                        className="h-4 w-4 rounded border-ink-soft/40 text-forest focus:ring-forest-mist"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 font-body text-xs text-ink-soft">
          Sem "Visualizar", o módulo fica oculto para este funcionário (rota bloqueada). "Editar"
          exige "Visualizar" junto.
        </p>
      </div>

      <div className={restrito ? '' : 'opacity-50'}>
        <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">
          Clientes vinculados {!restrito && '(ative "Acesso restrito" acima para usar)'}
        </p>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-ink-soft/15 p-2">
            {clientes.map((cliente) => (
              <label
                key={cliente.id}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-forest-mist/40"
              >
                <input
                  type="checkbox"
                  disabled={!restrito}
                  checked={permissoes.clientesVinculados.includes(cliente.id)}
                  onChange={() =>
                    onChange({
                      clientesVinculados: alternarItem(permissoes.clientesVinculados, cliente.id),
                    })
                  }
                  className="h-4 w-4 rounded border-ink-soft/40 text-forest focus:ring-forest-mist"
                />
                <span className="font-body text-sm text-ink">{cliente.nomeFantasia}</span>
              </label>
            ))}
          </div>

          <div>
            <p className="mb-2 font-mono text-xs uppercase tracking-wide text-ink-soft">
              Licitações atribuídas à parte
            </p>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-ink-soft/15 p-2">
              {mockLicitacoes.map((licitacao) => (
                <label
                  key={licitacao.id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-forest-mist/40"
                >
                  <input
                    type="checkbox"
                    disabled={!restrito}
                    checked={permissoes.licitacoesAtribuidas.includes(licitacao.id)}
                    onChange={() =>
                      onChange({
                        licitacoesAtribuidas: alternarItem(permissoes.licitacoesAtribuidas, licitacao.id),
                      })
                    }
                    className="h-4 w-4 rounded border-ink-soft/40 text-forest focus:ring-forest-mist"
                  />
                  <span className="font-body text-sm text-ink">
                    {licitacao.numeroPregao} — {licitacao.orgao}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
