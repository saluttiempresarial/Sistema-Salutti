// src/components/indicadores/FiltrosIndicadoresBar.tsx
//
// Barra de filtros globais do painel de Indicadores: Período (atalhos ou
// datas livres), Cliente, Modalidade e Família. Os filtros valem para todos
// os gráficos da página. O componente é controlado: quem o usa guarda os
// filtros no estado e recalcula os indicadores a cada mudança.

import { useMemo, useState } from 'react'
import { SelectField } from '../SelectField'
import {
  FILTRO_SEM_FAMILIA,
  type ClienteResumo,
  type FiltrosIndicadores,
} from '../../types/indicadores'
import { MODALIDADE_LICITACAO_LABEL, type ModalidadeLicitacao } from '../../types/licitacao'
import type { FamiliaProduto } from '../../services/familiaProdutoService'

type AtalhoPeriodo = 'todo' | 'mes' | 'trimestre' | 'ano' | 'personalizado'

const ATALHOS: { id: AtalhoPeriodo; rotulo: string }[] = [
  { id: 'todo', rotulo: 'Todo o período' },
  { id: 'mes', rotulo: 'Este mês' },
  { id: 'trimestre', rotulo: 'Este trimestre' },
  { id: 'ano', rotulo: 'Este ano' },
  { id: 'personalizado', rotulo: 'Personalizado' },
]

function paraISO(data: Date): string {
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${data.getFullYear()}-${mes}-${dia}`
}

function intervaloDoAtalho(atalho: AtalhoPeriodo): { dataDe?: string; dataAte?: string } {
  const hoje = new Date()
  const ano = hoje.getFullYear()
  const mes = hoje.getMonth()
  if (atalho === 'mes') {
    return { dataDe: paraISO(new Date(ano, mes, 1)), dataAte: paraISO(new Date(ano, mes + 1, 0)) }
  }
  if (atalho === 'trimestre') {
    const inicio = Math.floor(mes / 3) * 3
    return { dataDe: paraISO(new Date(ano, inicio, 1)), dataAte: paraISO(new Date(ano, inicio + 3, 0)) }
  }
  if (atalho === 'ano') {
    return { dataDe: `${ano}-01-01`, dataAte: `${ano}-12-31` }
  }
  return {}
}

interface FiltrosIndicadoresBarProps {
  filtros: FiltrosIndicadores
  onChange: (filtros: FiltrosIndicadores) => void
  clientes: ClienteResumo[]
  familias: FamiliaProduto[]
  /** Falso no painel do cliente (só existe a própria empresa). */
  mostrarCliente?: boolean
}

export function FiltrosIndicadoresBar({
  filtros,
  onChange,
  clientes,
  familias,
  mostrarCliente = true,
}: FiltrosIndicadoresBarProps) {
  const [atalho, setAtalho] = useState<AtalhoPeriodo>('todo')

  const opcoesClientes = useMemo(
    () => [
      { value: '', label: 'Todos os clientes' },
      ...[...clientes]
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
        .map((c) => ({ value: c.id, label: c.nome })),
    ],
    [clientes],
  )

  const opcoesModalidades = useMemo(
    () => [
      { value: '', label: 'Todas as modalidades' },
      ...(Object.keys(MODALIDADE_LICITACAO_LABEL) as ModalidadeLicitacao[]).map((m) => ({
        value: m,
        label: MODALIDADE_LICITACAO_LABEL[m],
      })),
    ],
    [],
  )

  // Famílias do cliente escolhido (ou de todos). Famílias com o mesmo nome em
  // clientes diferentes aparecem com o nome do cliente para não confundir.
  const opcoesFamilias = useMemo(() => {
    const visiveis = familias.filter((f) => !filtros.clienteId || f.clienteId === filtros.clienteId)
    const nomeCliente = new Map(clientes.map((c) => [c.id, c.nome]))
    return [
      { value: '', label: 'Todas as famílias' },
      { value: FILTRO_SEM_FAMILIA, label: 'Sem família' },
      ...visiveis
        .map((f) => ({
          value: f.id,
          label: filtros.clienteId ? f.nome : `${f.nome} (${nomeCliente.get(f.clienteId) ?? '—'})`,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')),
    ]
  }, [familias, clientes, filtros.clienteId])

  function escolherAtalho(novo: AtalhoPeriodo) {
    setAtalho(novo)
    if (novo === 'personalizado') return
    onChange({ ...filtros, ...intervaloDoAtalho(novo), ...(novo === 'todo' ? { dataDe: undefined, dataAte: undefined } : {}) })
  }

  function alterarCliente(clienteId: string) {
    // A família pertence a um cliente: ao trocar de cliente, o filtro de
    // família é limpo (exceto "Sem família", que vale para qualquer um).
    const manterFamilia = filtros.familiaId === FILTRO_SEM_FAMILIA
    onChange({
      ...filtros,
      clienteId: clienteId || undefined,
      familiaId: manterFamilia ? filtros.familiaId : undefined,
    })
  }

  const temFiltro = Boolean(
    filtros.dataDe || filtros.dataAte || filtros.clienteId || filtros.modalidade || filtros.familiaId,
  )

  return (
    <section
      aria-label="Filtros dos indicadores"
      className="rounded-xl border border-ink-soft/15 bg-white p-4 shadow-soft"
    >
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Período">
        <span className="mr-1 font-mono text-xs uppercase tracking-wide text-ink-soft">Período</span>
        {ATALHOS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => escolherAtalho(a.id)}
            aria-pressed={atalho === a.id}
            className={`rounded-full border px-3.5 py-1.5 font-body text-sm transition-colors ${
              atalho === a.id
                ? 'border-forest bg-forest text-white'
                : 'border-ink-soft/25 bg-white text-ink hover:bg-forest-mist'
            }`}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ind-data-de" className="font-mono text-xs uppercase tracking-wide text-ink-soft">
            Sessão de
          </label>
          <input
            id="ind-data-de"
            type="date"
            value={filtros.dataDe ?? ''}
            onChange={(e) => {
              setAtalho('personalizado')
              onChange({ ...filtros, dataDe: e.target.value || undefined })
            }}
            className="rounded-lg border border-ink-soft/25 bg-white px-3.5 py-2.5 font-body text-sm text-ink outline-none focus:border-forest focus:ring-2 focus:ring-forest-mist"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ind-data-ate" className="font-mono text-xs uppercase tracking-wide text-ink-soft">
            Sessão até
          </label>
          <input
            id="ind-data-ate"
            type="date"
            value={filtros.dataAte ?? ''}
            onChange={(e) => {
              setAtalho('personalizado')
              onChange({ ...filtros, dataAte: e.target.value || undefined })
            }}
            className="rounded-lg border border-ink-soft/25 bg-white px-3.5 py-2.5 font-body text-sm text-ink outline-none focus:border-forest focus:ring-2 focus:ring-forest-mist"
          />
        </div>
        {mostrarCliente && (
          <SelectField
            label="Cliente"
            value={filtros.clienteId ?? ''}
            options={opcoesClientes}
            onChange={(e) => alterarCliente(e.target.value)}
          />
        )}
        <SelectField
          label="Modalidade"
          value={filtros.modalidade ?? ''}
          options={opcoesModalidades}
          onChange={(e) => onChange({ ...filtros, modalidade: e.target.value || undefined })}
        />
        <SelectField
          label="Família"
          value={filtros.familiaId ?? ''}
          options={opcoesFamilias}
          onChange={(e) => onChange({ ...filtros, familiaId: e.target.value || undefined })}
        />
      </div>

      {temFiltro && (
        <button
          type="button"
          onClick={() => {
            setAtalho('todo')
            onChange({})
          }}
          className="mt-3 font-body text-sm text-forest underline-offset-2 hover:underline"
        >
          Limpar filtros
        </button>
      )}
    </section>
  )
}
