// src/pages/cliente/PropostaComercialPage.tsx
//
// Tela cheia de Proposta Comercial do Cliente — rota
// /cliente/licitacoes/:id/proposta, aberta ao clicar "Quero Participar"
// em LicitacaoDetalhePage. Substitui o antigo PropostaParticipacaoModal
// (que abria por cima da página, como popup) — agora é uma página própria,
// porque a tabela (Itens + Proposta Comercial + Análise, igual à planilha
// real da Salutti) tem colunas demais para caber num modal.
//
// Ao confirmar, salva a proposta comercial (registrarPropostaCliente) e
// registra a decisão do cliente como "participar" (registrarDecisaoCliente)
// — mesmo fluxo que o modal antigo fazia, só que em tela cheia.

import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { DashboardShell } from '@/components/DashboardShell'
import { useAuth } from '@/context/AuthContext'
import { licitacaoService } from '@/services/licitacaoService'
import { PropostaComercialTable, SalvarPropostaComercialPayload } from '@/components/Licitacoes/PropostaComercialTable'
import { Licitacao } from '@/types/licitacao'

export function PropostaComercialPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [licitacao, setLicitacao] = useState<Licitacao | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!id) return
    let ativo = true
    setCarregando(true)
    licitacaoService.buscarPorId(id).then((resultado) => {
      if (!ativo) return
      setLicitacao(resultado)
      setCarregando(false)
    })
    return () => {
      ativo = false
    }
  }, [id])

  const [erro, setErro] = useState<string | null>(null)

  async function handleSalvar(payload: SalvarPropostaComercialPayload) {
    if (!user || !id) return
    setSalvando(true)
    setErro(null)
    try {
      await licitacaoService.registrarPropostaCliente(id, payload.propostaPorItem)
      await licitacaoService.registrarDecisaoCliente(id, 'participar', user.name, {
        cobrarFrete: payload.incluirFrete,
        percentualFrete: payload.incluirFrete ? payload.percentualFrete : undefined,
      })
      navigate('/cliente')
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : 'Erro desconhecido ao salvar a proposta.'
      console.error('Falha ao confirmar participação:', e)
      setErro(mensagem)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <DashboardShell
      title={licitacao ? `Sua proposta — ${licitacao.numeroPregao}` : 'Sua proposta'}
      subtitle={licitacao?.objeto}
    >
      <Link
        to={id ? `/cliente/licitacoes/${id}` : '/cliente'}
        className="mb-4 inline-flex items-center gap-1.5 font-body text-sm font-semibold text-forest hover:underline"
      >
        ← Voltar
      </Link>

      {carregando || !licitacao ? (
        <div className="mt-6 flex min-h-[240px] items-center justify-center">
          <p className="font-body text-sm text-ink-soft">Carregando itens...</p>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-ink-soft/10 bg-white p-6 shadow-soft">
          {erro && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <p className="font-body text-sm font-semibold text-red-700">Não foi possível confirmar a participação</p>
              <p className="mt-0.5 font-body text-xs text-red-700">{erro}</p>
            </div>
          )}
          <PropostaComercialTable
            licitacao={licitacao}
            podeEditarItens={false}
            podeEditarPropostaComercial={true}
            mostrarResumo={true}
            salvando={salvando}
            onSalvar={handleSalvar}
            textoBotaoSalvar="Confirmar participação"
          />
        </div>
      )}
    </DashboardShell>
  )
}
