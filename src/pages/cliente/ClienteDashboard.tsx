// src/pages/cliente/ClienteDashboard.tsx
//
// Portal do Cliente — mostra as licitações atribuídas ao cliente logado e
// permite registrar a decisão de participar ou não (Especificação
// Funcional v2.1, seção 4.3 / 6.2: botões "Quero Participar" / "Não vou
// participar"). Usa `licitacaoService.listarPorCliente` e
// `licitacaoService.registrarDecisaoCliente`, que já existiam prontos
// desde a reconstrução do módulo de Licitações.
//
// Ao confirmar participação, o cliente também informa se deseja incluir
// frete (spec 2.3 / 4.3: "Indicar se deseja incluir frete") — painel
// inline que abre ao clicar em "Quero Participar", antes da confirmação
// definitiva.
//
// NOTA DE ESCOPO: o preenchimento de proposta por item (Código interno,
// Marca, Modelo, Preço Mínimo — spec 6.2) não foi construído nesta
// passada; aqui o cliente confirma/recusa participação e informa frete.
// Ver nota equivalente em types/licitacao.ts.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { DashboardShell, StatCard } from '@/components/DashboardShell'
import { useAuth } from '@/context/AuthContext'
import { StatusPill, StatusTone } from '@/components/StatusPill'
import { Button } from '@/components/Button'
import { TextAreaField } from '@/components/TextAreaField'
import { TextField } from '@/components/TextField'
import { CheckboxField } from '@/components/CheckboxField'
import { licitacaoService } from '@/services/licitacaoService'
import { LicitacaoDetalheModal } from './LicitacaoDetalheModal'
import {
  Licitacao,
  StatusLicitacao,
  STATUS_LICITACAO_LABEL,
  ModalidadeLicitacao,
  MODALIDADE_LICITACAO_LABEL,
} from '@/types/licitacao'
import { formatarDataHora, formatarMoeda, classificarUrgenciaPrazo } from '@/utils/prazoUtils'

const STATUS_TONE: Record<StatusLicitacao, StatusTone> = {
  pendente: 'neutral',
  em_analise: 'info',
  enviado: 'warning',
  ganho: 'success',
  perdido: 'danger',
}

export function ClienteDashboard() {
  const { user } = useAuth()
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [decidindoId, setDecidindoId] = useState<string | null>(null)
  const [recusandoId, setRecusandoId] = useState<string | null>(null)
  const [motivoRecusa, setMotivoRecusa] = useState('')
  const [participandoId, setParticipandoId] = useState<string | null>(null)
  const [incluirFrete, setIncluirFrete] = useState(false)
  const [percentualFrete, setPercentualFrete] = useState<number | undefined>(undefined)
  const [detalheId, setDetalheId] = useState<string | null>(null)
  const [licitacaoDetalhe, setLicitacaoDetalhe] = useState<Licitacao | null>(null)
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)

  async function abrirDetalhe(id: string) {
    setDetalheId(id)
    setCarregandoDetalhe(true)
    try {
      const completa = await licitacaoService.buscarPorId(id)
      setLicitacaoDetalhe(completa)
    } finally {
      setCarregandoDetalhe(false)
    }
  }

  const carregar = useCallback(async () => {
    if (!user?.clienteId) {
      setCarregando(false)
      return
    }
    setCarregando(true)
    const itens = await licitacaoService.listarPorCliente(user.clienteId)
    setLicitacoes(itens)
    setCarregando(false)
  }, [user?.clienteId])

  useEffect(() => {
    carregar()
  }, [carregar])

  const aguardandoDecisao = useMemo(
    () => licitacoes.filter((l) => l.decisaoCliente === 'pendente'),
    [licitacoes]
  )
  const participando = useMemo(
    () => licitacoes.filter((l) => l.decisaoCliente === 'participar'),
    [licitacoes]
  )

  function abrirParticipacao(id: string) {
    setParticipandoId(id)
    setIncluirFrete(false)
    setPercentualFrete(undefined)
  }

  async function confirmarParticipacao() {
    if (!user || !participandoId) return
    setDecidindoId(participandoId)
    try {
      await licitacaoService.registrarDecisaoCliente(participandoId, 'participar', user.name, {
        cobrarFrete: incluirFrete,
        percentualFrete: incluirFrete ? percentualFrete : undefined,
      })
      await carregar()
      setParticipandoId(null)
    } finally {
      setDecidindoId(null)
    }
  }

  function abrirRecusa(id: string) {
    setRecusandoId(id)
    setMotivoRecusa('')
  }

  async function confirmarRecusa() {
    if (!user || !recusandoId) return
    setDecidindoId(recusandoId)
    try {
      await licitacaoService.registrarDecisaoCliente(recusandoId, 'recusar', user.name, {
        motivoRecusa: motivoRecusa.trim() || undefined,
      })
      await carregar()
      setRecusandoId(null)
    } finally {
      setDecidindoId(null)
    }
  }

  if (!user?.clienteId) {
    return (
      <DashboardShell title={`Bem-vindo, ${user?.name ?? 'Cliente'}`}>
        <div className="rounded-xl border border-ink-soft/10 bg-white p-6 shadow-soft">
          <p className="font-body text-sm text-ink-soft">
            Este login não está vinculado a um registro de cliente ainda. Peça para a equipe Salutti
            associar seu usuário a um cliente cadastrado.
          </p>
        </div>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell
      title={`Bem-vindo, ${user.name}`}
      subtitle="Acompanhe suas licitações e confirme sua participação."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Licitações acompanhadas" value={String(licitacoes.length)} />
        <StatCard
          label="Aguardando sua decisão"
          value={String(aguardandoDecisao.length)}
          hint={aguardandoDecisao.length > 0 ? 'Responda o quanto antes — o prazo é curto' : undefined}
        />
        <StatCard label="Participando" value={String(participando.length)} />
      </div>

      <div className="mt-8 space-y-4">
        {carregando && (
          <div className="rounded-xl border border-ink-soft/10 bg-white p-6 text-center font-body text-sm text-ink-soft shadow-soft">
            Carregando suas licitações...
          </div>
        )}

        {!carregando && licitacoes.length === 0 && (
          <div className="rounded-xl border border-ink-soft/10 bg-white p-6 text-center font-body text-sm text-ink-soft shadow-soft">
            Nenhuma licitação atribuída a você ainda.
          </div>
        )}

        {!carregando &&
          licitacoes.map((licitacao) => {
            const dataReferencia = licitacao.dataEfetivaLicitacao || licitacao.dataLicitacao
            const urgencia = classificarUrgenciaPrazo(dataReferencia)
            const estaRecusando = recusandoId === licitacao.id
            const estaParticipando = participandoId === licitacao.id
            const decidindo = decidindoId === licitacao.id

            return (
              <div key={licitacao.id} className="rounded-xl border border-ink-soft/10 bg-white p-5 shadow-soft">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <button
                      type="button"
                      onClick={() => abrirDetalhe(licitacao.id)}
                      className="text-left font-display text-lg font-semibold text-forest-deep hover:underline"
                    >
                      {licitacao.numeroPregao} — {licitacao.orgao}
                    </button>
                    <p className="mt-0.5 font-body text-sm text-ink-soft">{licitacao.objeto}</p>
                  </div>
                  <StatusPill label={STATUS_LICITACAO_LABEL[licitacao.status]} tone={STATUS_TONE[licitacao.status]} />
                </div>

                <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 font-body text-sm text-ink-soft sm:grid-cols-4">
                  <p>
                    <span className="text-ink-soft/70">Modalidade:</span>{' '}
                    {MODALIDADE_LICITACAO_LABEL[licitacao.modalidade as ModalidadeLicitacao] ?? licitacao.modalidade}
                  </p>
                  <p>
                    <span className="text-ink-soft/70">Sessão:</span> {formatarDataHora(dataReferencia)}
                    {urgencia === 'vencido' && <span className="ml-1 font-medium text-red-600">⚠ vencido</span>}
                    {urgencia === 'atencao' && <span className="ml-1 font-medium text-brass">⚠ prazo próximo</span>}
                  </p>
                  <p>
                    <span className="text-ink-soft/70">Valor:</span>{' '}
                    {licitacao.valorTotalLicitacao != null ? formatarMoeda(licitacao.valorTotalLicitacao) : 'Sigiloso'}
                  </p>
                  <p>
                    <span className="text-ink-soft/70">Portal:</span> {licitacao.portal}
                  </p>
                </div>

                {licitacao.decisaoCliente === 'pendente' && !estaRecusando && !estaParticipando && (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-ink-soft/10 pt-4">
                    <Button onClick={() => abrirParticipacao(licitacao.id)} disabled={decidindo}>
                      Quero Participar
                    </Button>
                    <Button variant="ghost" onClick={() => abrirRecusa(licitacao.id)} disabled={decidindo}>
                      Não vou participar
                    </Button>
                  </div>
                )}

                {estaParticipando && (
                  <div className="mt-4 space-y-3 border-t border-ink-soft/10 pt-4">
                    <CheckboxField
                      label="Incluir frete?"
                      checked={incluirFrete}
                      onChange={(e) => setIncluirFrete(e.target.checked)}
                    />
                    {incluirFrete && (
                      <TextField
                        label="Percentual de frete (%)"
                        type="number"
                        value={percentualFrete ?? ''}
                        onChange={(e) =>
                          setPercentualFrete(e.target.value === '' ? undefined : Number(e.target.value))
                        }
                        className="max-w-xs"
                      />
                    )}
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={() => setParticipandoId(null)} disabled={decidindo}>
                        Cancelar
                      </Button>
                      <Button onClick={confirmarParticipacao} disabled={decidindo}>
                        {decidindo ? 'Salvando...' : 'Confirmar participação'}
                      </Button>
                    </div>
                  </div>
                )}

                {estaRecusando && (
                  <div className="mt-4 space-y-3 border-t border-ink-soft/10 pt-4">
                    <TextAreaField
                      label="Motivo da recusa (opcional)"
                      value={motivoRecusa}
                      onChange={(e) => setMotivoRecusa(e.target.value)}
                      rows={2}
                      placeholder="Ex: fora do nosso escopo de atuação no momento"
                    />
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={() => setRecusandoId(null)} disabled={decidindo}>
                        Cancelar
                      </Button>
                      <Button onClick={confirmarRecusa} disabled={decidindo}>
                        {decidindo ? 'Salvando...' : 'Confirmar recusa'}
                      </Button>
                    </div>
                  </div>
                )}

                {licitacao.decisaoCliente !== 'pendente' && (
                  <div className="mt-4 border-t border-ink-soft/10 pt-3 font-body text-xs text-ink-soft">
                    {licitacao.decisaoCliente === 'participar' ? '✓ Você confirmou participação' : '✗ Você recusou participar'}
                    {licitacao.decisaoClienteEm && ` em ${formatarDataHora(licitacao.decisaoClienteEm)}`}
                    {licitacao.motivoRecusaCliente && ` — "${licitacao.motivoRecusaCliente}"`}
                    {licitacao.decisaoCliente === 'participar' && licitacao.cobrarFrete && (
                      <span>
                        {' '}
                        — frete: {licitacao.percentualFrete != null ? `${licitacao.percentualFrete}%` : 'a definir'}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
      </div>

      <LicitacaoDetalheModal
        isOpen={!!detalheId}
        onClose={() => setDetalheId(null)}
        licitacao={licitacaoDetalhe}
        carregando={carregandoDetalhe}
      />
    </DashboardShell>
  )
}
