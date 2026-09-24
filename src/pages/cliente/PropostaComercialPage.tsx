// src/pages/cliente/PropostaComercialPage.tsx
//
// Tela cheia de Proposta Comercial do Cliente — rota
// /cliente/licitacoes/:id/proposta, aberta ao clicar "Quero Participar"
// em LicitacaoDetalhePage. Substitui o antigo PropostaParticipacaoModal
// (que abria por cima da página, como popup) — agora é uma página própria,
// porque a visualização (Itens + Proposta Comercial + Análise) tem
// informação demais para caber num modal.
//
// Ao confirmar, salva a proposta comercial (registrarPropostaCliente) e
// registra a decisão do cliente como "participar" (registrarDecisaoCliente)
// — mesmo fluxo que o modal antigo fazia, só que em tela cheia.
//
// Usa PropostaComercialCards (visualização em cartões por Grupo → Item,
// no lugar da tabela densa estilo planilha — PropostaComercialTable NÃO
// está mais em uso em nenhuma tela do sistema; comentário anterior aqui
// dizia o contrário e estava desatualizado. Mantida no repositório só como
// referência histórica; se for reativada em algum momento, confira antes se
// as correções de cálculo feitas em PropostaComercialCards/licitacaoCalculos
// (24/09) também foram replicadas lá).
//
// Duas checagens que antes só existiam na tela anterior (LicitacaoDetalhePage)
// foram reforçadas aqui também, porque é nesta tela que o Cliente de fato
// edita e salva:
//   1. Porte da empresa (porteCliente) — sem isso, o bloqueio de itens
//      "Exclusivo ME/EPP" (por item, não pela licitação inteira) nunca
//      era aplicado nesta tela.
//   2. Prazo de edição (podeEditarPropostaCliente) — sem isso, um Cliente
//      que já estivesse com esta tela aberta continuava conseguindo salvar
//      mesmo depois do prazo de 3 dias antes da sessão vencer.

import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { DashboardShell } from '@/components/DashboardShell'
import { useAuth } from '@/context/AuthContext'
import { licitacaoService } from '@/services/licitacaoService'
import { clienteService } from '@/services/clienteService'
import {
  PropostaComercialCards,
  SalvarPropostaComercialPayload,
} from '@/components/Licitacoes/PropostaComercialCards'
import { Licitacao } from '@/types/licitacao'
import { PorteEmpresa } from '@/types/cliente'
import { podeEditarPropostaCliente, prazoPropostaClienteInfo } from '@/utils/licitacaoCalculos'

export function PropostaComercialPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [licitacao, setLicitacao] = useState<Licitacao | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [porteCliente, setPorteCliente] = useState<PorteEmpresa | null>(null)
  const [erroPrazo, setErroPrazo] = useState<string | null>(null)

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

  // Porte da empresa do cliente logado — necessário para o bloqueio de
  // itens "Exclusivo ME/EPP" dentro do próprio card do item (ver
  // PropostaComercialCards, prop porteCliente).
  useEffect(() => {
    if (!user?.clienteId) return
    let ativo = true
    clienteService.getById(user.clienteId).then((cliente) => {
      if (ativo && cliente) setPorteCliente(cliente.empresa.porte)
    })
    return () => {
      ativo = false
    }
  }, [user?.clienteId])

  const dentroDoPrazo = licitacao ? podeEditarPropostaCliente(licitacao) : true

  async function handleSalvar(payload: SalvarPropostaComercialPayload) {
    if (!user || !id || !licitacao) return
    // Revalidação no momento do envio — evita salvar uma proposta iniciada
    // dentro do prazo mas confirmada só depois dele vencer (ex.: aba aberta
    // há dias, computador que ficou hibernando, etc.).
    if (!podeEditarPropostaCliente(licitacao)) {
      setErroPrazo('O prazo para editar e confirmar esta proposta já foi encerrado. Atualize a página para ver a situação atual.')
      return
    }
    setSalvando(true)
    try {
      await licitacaoService.registrarPropostaCliente(id, payload.propostaPorItem)
      await licitacaoService.registrarDecisaoCliente(id, 'participar', user.name, {
        cobrarFrete: payload.incluirFrete,
        percentualFrete: payload.incluirFrete ? payload.percentualFrete : undefined,
      })
      navigate('/cliente')
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
          {!dentroDoPrazo && (
            <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 font-body text-xs text-amber-800">
              O prazo para editar e confirmar esta proposta já foi encerrado
              ({prazoPropostaClienteInfo(licitacao).texto}). A visualização abaixo é somente leitura.
            </p>
          )}
          {erroPrazo && (
            <p className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 font-body text-xs text-red-700">
              {erroPrazo}
            </p>
          )}
          <PropostaComercialCards
            licitacao={licitacao}
            podeEditarItens={false}
            podeEditarPropostaComercial={dentroDoPrazo}
            porteCliente={porteCliente ?? undefined}
            salvando={salvando}
            onSalvar={handleSalvar}
            textoBotaoSalvar="Confirmar participação"
          />
        </div>
      )}
    </DashboardShell>
  )
}
