// src/pages/cliente/InicioPage.tsx
//
// Página inicial do Portal do Cliente (rota /cliente) — criada em 19/10, a
// pedido do Márcio, no mesmo modelo do Início do Admin/Funcionário:
// saudação, três cartões de resumo, atalho para as licitações que aguardam a
// decisão do cliente, calendário ampliado, painel "Próximos eventos" e a
// tabela "Minhas licitações" (as 10 de prazo mais próximo; a lista completa
// fica na tela Licitações, /cliente/licitacoes).

import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { licitacaoService } from '@/services/licitacaoService'
import { CabecalhoPainel } from '@/components/dashboard/CabecalhoPainel'
import { CartaoResumo } from '@/components/dashboard/CartaoResumo'
import { Etiqueta } from '@/components/dashboard/Etiqueta'
import { ProximosEventos } from '@/components/dashboard/ProximosEventos'
import { TabelaMinhasLicitacoes } from '@/components/dashboard/TabelaMinhasLicitacoes'
import { CalendarioLicitacoes } from '@/components/Licitacoes/CalendarioLicitacoes'
import {
  IconeCalendario,
  IconeCalendarioRelogio,
  IconeDocumento,
  IconeMartelo,
  IconeSetaDireita,
} from '@/components/icones'
import type { Licitacao } from '@/types/licitacao'
import { calcularPrazoInterno, classificarUrgenciaPrazo, formatarDataHora } from '@/utils/prazoUtils'

const URGENCIA_CLASSE: Record<string, string> = {
  vencido: 'font-medium text-red-600',
  atencao: 'font-medium text-brass',
  ok: 'font-medium text-forest-deep',
}

// Quantas licitações aguardando decisão aparecem na lista do Início.
const MAXIMO_PENDENTES = 5

// Quantas licitações aparecem na tabela "Minhas licitações" do Início.
const MAXIMO_NA_TABELA = 10

export function InicioPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!user?.clienteId) {
      setCarregando(false)
      return
    }
    let ativo = true
    licitacaoService.listarPorCliente(user.clienteId).then((itens) => {
      if (!ativo) return
      setLicitacoes(itens)
      setCarregando(false)
    })
    return () => {
      ativo = false
    }
  }, [user?.clienteId])

  // Aguardando a decisão do cliente, com o prazo de resposta mais próximo primeiro.
  const aguardandoDecisao = useMemo(() => {
    return licitacoes
      .filter((l) => l.decisaoCliente === 'pendente')
      .sort(
        (a, b) =>
          calcularPrazoInterno(a.dataEfetivaLicitacao || a.dataLicitacao).getTime() -
          calcularPrazoInterno(b.dataEfetivaLicitacao || b.dataLicitacao).getTime()
      )
  }, [licitacoes])

  const participando = useMemo(
    () => licitacoes.filter((l) => l.decisaoCliente === 'participar'),
    [licitacoes]
  )

  // Painel "Próximos eventos": só licitações ainda em andamento (mesma regra
  // da tela Calendário).
  // O calendário não mostra as licitações que o cliente recusou: as datas delas
  // não exigem mais nada dele. Ganhas e perdidas continuam (histórico).
  const noCalendario = useMemo(
    () => licitacoes.filter((l) => l.decisaoCliente !== 'recusar'),
    [licitacoes]
  )

  const emAndamento = useMemo(
    () =>
      licitacoes.filter(
        (l) => l.status !== 'ganho' && l.status !== 'perdido' && l.decisaoCliente !== 'recusar'
      ),
    [licitacoes]
  )

  const container = 'mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8'

  if (!user?.clienteId) {
    return (
      <div className={container}>
        <h1 className="mb-4 font-display text-2xl font-semibold text-forest-deep sm:text-3xl">
          Bem-vindo, {user?.name ?? 'Cliente'}
        </h1>
        <div className="rounded-2xl border border-ink-soft/10 bg-white p-6 shadow-soft">
          <p className="font-body text-sm text-ink-soft">
            Este login não está vinculado a um registro de cliente ainda. Peça para a equipe Salutti
            associar seu usuário a um cliente cadastrado.
          </p>
        </div>
      </div>
    )
  }

  const pendentesVisiveis = aguardandoDecisao.slice(0, MAXIMO_PENDENTES)

  return (
    <div className={container}>
      <CabecalhoPainel nome={user.name} subtitulo="Acompanhe suas licitações e confirme sua participação." />

      <div className="mt-6 grid gap-4 md:grid-cols-3 md:gap-5">
        <CartaoResumo
          titulo="Licitações acompanhadas"
          valor={String(licitacoes.length)}
          legenda="no total"
          icone={<IconeDocumento className="h-7 w-7 sm:h-8 sm:w-8" />}
          tom="verde"
          to="/cliente/licitacoes"
        />
        <CartaoResumo
          titulo="Aguardando sua decisão"
          valor={String(aguardandoDecisao.length)}
          legenda={
            aguardandoDecisao.length > 0 ? 'Responda o quanto antes — o prazo é curto' : 'nenhuma pendente'
          }
          icone={<IconeCalendarioRelogio className="h-7 w-7 sm:h-8 sm:w-8" />}
          tom="dourado"
        />
        <CartaoResumo
          titulo="Participando"
          valor={String(participando.length)}
          legenda="com participação confirmada"
          icone={<IconeMartelo className="h-7 w-7 sm:h-8 sm:w-8" />}
          tom="azul"
        />
      </div>

      {!carregando && aguardandoDecisao.length > 0 && (
        <section className="mt-6 rounded-2xl border border-brass/30 bg-white p-4 shadow-soft sm:p-6">
          <header className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <IconeCalendarioRelogio className="h-6 w-6 text-brass" />
              <h2 className="font-display text-xl font-semibold text-forest-deep">Aguardando sua decisão</h2>
            </div>
            <Etiqueta rotulo={String(aguardandoDecisao.length)} tom="warning" />
          </header>

          <ul className="divide-y divide-ink-soft/10 overflow-hidden rounded-xl border border-ink-soft/10">
            {pendentesVisiveis.map((licitacao) => {
              const dataReferencia = licitacao.dataEfetivaLicitacao || licitacao.dataLicitacao
              const urgencia = classificarUrgenciaPrazo(dataReferencia)
              const prazo = calcularPrazoInterno(dataReferencia)
              return (
                <li key={licitacao.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/cliente/licitacoes/${licitacao.id}`)}
                    className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-paper-2/60"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-body text-sm font-semibold text-ink">
                        {licitacao.numeroPregao}
                        <span className="font-normal text-ink-soft"> — {licitacao.orgao}</span>
                      </p>
                      <p className="font-body text-xs text-ink-soft">
                        Sessão em {formatarDataHora(dataReferencia)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right font-body text-xs">
                      <p className="text-ink-soft">Data de retorno</p>
                      <p className={URGENCIA_CLASSE[urgencia]}>{formatarDataHora(prazo.toISOString())}</p>
                    </div>
                    <IconeSetaDireita className="h-5 w-5 shrink-0 text-ink-soft" />
                  </button>
                </li>
              )
            })}
          </ul>

          {aguardandoDecisao.length > MAXIMO_PENDENTES && (
            <p className="mt-3 font-body text-sm text-ink-soft">
              e mais {aguardandoDecisao.length - MAXIMO_PENDENTES}.{' '}
              <Link to="/cliente/licitacoes" className="font-semibold text-forest hover:underline">
                Ver todas as licitações
              </Link>
            </p>
          )}
        </section>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section className="rounded-2xl border border-ink-soft/10 bg-white p-5 shadow-soft sm:p-6">
          <div className="mb-4 flex items-center gap-2.5">
            <IconeCalendario className="h-6 w-6 text-forest" />
            <h2 className="font-display text-xl font-semibold text-forest-deep">Calendário</h2>
          </div>
          {carregando ? (
            <p className="py-10 text-center font-body text-sm text-ink-soft">Carregando...</p>
          ) : (
            <CalendarioLicitacoes
              licitacoes={noCalendario}
              amplo
              mostrarLegenda={false}
              rotuloPrazo="Data de retorno"
            />
          )}
        </section>

        <ProximosEventos
          licitacoes={emAndamento}
          carregando={carregando}
          rotaLicitacao={(id) => `/cliente/licitacoes/${id}`}
          linkVerTodos={null}
          rotuloPrazo="Data de retorno"
        />
      </div>

      <div className="mt-6">
        <TabelaMinhasLicitacoes
          licitacoes={licitacoes}
          carregando={carregando}
          limite={MAXIMO_NA_TABELA}
          linkVerTodas="/cliente/licitacoes"
        />
      </div>
    </div>
  )
}
