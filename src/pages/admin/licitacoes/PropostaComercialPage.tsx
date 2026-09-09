// src/pages/admin/licitacoes/PropostaComercialPage.tsx
//
// Tela cheia de Proposta Comercial — rota /admin/licitacoes/:id/proposta.
// Acessada a partir da listagem de Licitações (LicitacoesPage), botão
// "Ver proposta" por linha.
//
// Usa o MESMO componente de tabela que o Cliente usa (PropostaComercialTable)
// — garante que Admin e Cliente sempre vejam exatamente as mesmas colunas e
// informações. A diferença é só de permissão:
//   - Admin: edita tudo (Itens de referência + Proposta Comercial)
//   - Funcionário: só visualiza (nenhum dos dois blocos é editável aqui)
//
// Diferente da página do Cliente, aqui não existe "decisão" a registrar —
// é só edição/consulta dos dados, então ao salvar a página recarrega os
// dados e permanece aberta (não navega embora).

import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { licitacaoService } from '@/services/licitacaoService'
import { PropostaComercialTable, SalvarPropostaComercialPayload } from '@/components/Licitacoes/PropostaComercialTable'
import { Licitacao } from '@/types/licitacao'

export function PropostaComercialPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [licitacao, setLicitacao] = useState<Licitacao | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [salvoEm, setSalvoEm] = useState<number | null>(null)

  const carregar = useCallback(async () => {
    if (!id) return
    setCarregando(true)
    const resultado = await licitacaoService.buscarPorId(id)
    setLicitacao(resultado)
    setCarregando(false)
  }, [id])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function handleSalvar(payload: SalvarPropostaComercialPayload) {
    if (!id) return
    setSalvando(true)
    try {
      const tarefas: Promise<unknown>[] = [licitacaoService.registrarPropostaCliente(id, payload.propostaPorItem)]
      if (payload.itensReferencia) {
        tarefas.push(licitacaoService.atualizarItensReferencia(id, payload.itensReferencia))
      }
      await Promise.all(tarefas)
      await carregar()
      setSalvoEm(Date.now())
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="min-h-screen bg-paper p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            to="/admin/licitacoes"
            className="mb-2 inline-flex items-center gap-1.5 font-body text-sm font-semibold text-forest hover:underline"
          >
            ← Voltar para Licitações
          </Link>
          <h1 className="font-display text-2xl text-ink">
            {licitacao ? `Proposta Comercial — ${licitacao.numeroPregao}` : 'Proposta Comercial'}
          </h1>
          {licitacao && <p className="font-body text-sm text-ink-soft">{licitacao.objeto}</p>}
        </div>
        {salvoEm && (
          <span className="rounded-full bg-forest-mist px-3 py-1.5 font-body text-xs font-medium text-forest-deep">
            Alterações salvas
          </span>
        )}
      </div>

      {carregando || !licitacao ? (
        <div className="flex min-h-[240px] items-center justify-center">
          <p className="font-body text-sm text-ink-soft">Carregando itens...</p>
        </div>
      ) : (
        <div className="rounded-xl border border-ink-soft/10 bg-white p-6 shadow-soft">
          {!isAdmin && (
            <p className="mb-4 rounded-lg bg-paper-2/60 px-3 py-2 font-body text-xs text-ink-soft">
              Modo somente leitura — apenas o Administrador pode editar os itens e a proposta comercial.
            </p>
          )}
          <PropostaComercialTable
            licitacao={licitacao}
            podeEditarItens={isAdmin}
            podeEditarPropostaComercial={isAdmin}
            salvando={salvando}
            onSalvar={handleSalvar}
            textoBotaoSalvar="Salvar alterações"
          />
        </div>
      )}
    </div>
  )
}
