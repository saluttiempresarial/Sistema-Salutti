// src/components/indicadores/LiberacaoAnalistasSecao.tsx
//
// Seção de Configurações: liberação dos Indicadores POR ANALISTA (migração 046).
// A coluna "Analista" da seção de nível 1 é o PADRÃO de todos; aqui o
// Administrador define as diferenças de cada analista. A lista mostra, de
// relance, quem segue o padrão e quem foi personalizado. "Editar" abre os
// indicadores de um analista por vez, com "Voltar ao padrão" e "Copiar de".

import { useEffect, useMemo, useState } from 'react'
import { Button } from '../Button'
import { SelectField } from '../SelectField'
import {
  CATALOGO_INDICADORES,
  liberacaoIndicadoresService,
} from '../../services/liberacaoIndicadoresService'
import {
  liberacaoAnalistaService,
  type AnalistaResumo,
  type ExcecoesPorAnalista,
} from '../../services/liberacaoAnalistaService'

/** Acima disto aparece o campo de busca por nome. */
const LIMITE_SEM_BUSCA = 6

/** Valor efetivo de cada indicador: o padrão, trocado pelas exceções. */
function efetivosDoAnalista(
  padrao: Record<string, boolean>,
  excecoes: Record<string, boolean> | undefined,
): Record<string, boolean> {
  const efetivos: Record<string, boolean> = {}
  for (const ind of CATALOGO_INDICADORES) {
    efetivos[ind.chave] = excecoes?.[ind.chave] ?? padrao[ind.chave] ?? false
  }
  return efetivos
}

export function LiberacaoAnalistasSecao() {
  const [analistas, setAnalistas] = useState<AnalistaResumo[]>([])
  const [padrao, setPadrao] = useState<Record<string, boolean>>({})
  const [excecoes, setExcecoes] = useState<ExcecoesPorAnalista>({})
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState('')

  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [rascunho, setRascunho] = useState<Record<string, boolean>>({})
  const [copiarDe, setCopiarDe] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      liberacaoAnalistaService.listarAnalistas(),
      liberacaoIndicadoresService.listar(),
      liberacaoAnalistaService.carregarExcecoes(),
    ])
      .then(([listaAnalistas, liberacaoPerfil, mapaExcecoes]) => {
        setAnalistas(listaAnalistas)
        setPadrao(
          Object.fromEntries(
            Object.entries(liberacaoPerfil).map(([chave, perfis]) => [chave, perfis.analista]),
          ),
        )
        setExcecoes(mapaExcecoes)
      })
      .catch((e: unknown) =>
        setErro(e instanceof Error ? e.message : 'Erro ao carregar a liberação por analista.'),
      )
      .finally(() => setCarregando(false))
  }, [])

  const analistasFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return analistas
    return analistas.filter((a) => a.nome.toLowerCase().includes(termo))
  }, [analistas, busca])

  const editando = analistas.find((a) => a.id === editandoId) ?? null

  function abrirEdicao(analista: AnalistaResumo) {
    setMensagem(null)
    setErro(null)
    setCopiarDe('')
    setEditandoId(analista.id)
    setRascunho(efetivosDoAnalista(padrao, excecoes[analista.id]))
  }

  function fecharEdicao() {
    setEditandoId(null)
    setCopiarDe('')
  }

  function alternar(indicador: string, liberado: boolean) {
    setMensagem(null)
    setRascunho((atual) => ({ ...atual, [indicador]: liberado }))
  }

  function copiarDeOutroAnalista(origemId: string) {
    setCopiarDe(origemId)
    if (!origemId) return
    setMensagem(null)
    setRascunho(efetivosDoAnalista(padrao, excecoes[origemId]))
  }

  async function salvar() {
    if (!editando) return
    setSalvando(true)
    setErro(null)
    try {
      const novas = liberacaoAnalistaService.diferencasDoPadrao(padrao, rascunho)
      await liberacaoAnalistaService.salvarExcecoes(editando.id, novas)
      setExcecoes((atual) => {
        const proximo = { ...atual }
        if (Object.keys(novas).length === 0) delete proximo[editando.id]
        else proximo[editando.id] = novas
        return proximo
      })
      setMensagem(`Liberação de ${editando.nome} salva.`)
      fecharEdicao()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar a liberação do analista.')
    } finally {
      setSalvando(false)
    }
  }

  async function voltarAoPadrao() {
    if (!editando) return
    setSalvando(true)
    setErro(null)
    try {
      await liberacaoAnalistaService.restaurarPadrao(editando.id)
      setExcecoes((atual) => {
        const proximo = { ...atual }
        delete proximo[editando.id]
        return proximo
      })
      setMensagem(`${editando.nome} voltou a seguir o padrão.`)
      fecharEdicao()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao voltar o analista ao padrão.')
    } finally {
      setSalvando(false)
    }
  }

  const totalCatalogo = CATALOGO_INDICADORES.length
  const opcoesCopia = [
    { value: '', label: 'Copiar de outro analista...' },
    ...analistas.filter((a) => a.id !== editandoId).map((a) => ({ value: a.id, label: a.nome })),
  ]

  return (
    <section className="rounded-xl border border-charcoal-3/10 bg-white p-6 shadow-soft">
      <h2 className="font-display text-lg font-semibold text-forest-deep">Liberação por analista</h2>
      <p className="mt-1 font-body text-sm text-ink-soft">
        Por padrão, todos os analistas veem o que está marcado na coluna "Analista" da tabela acima
        (valor já salvo). Aqui você define as diferenças de cada analista. Quem não foi
        personalizado segue o padrão, e analistas novos entram com ele. Isto controla o que o analista
        vê na tela de Indicadores; o acesso aos dados da carteira dele não muda.
      </p>

      {carregando && <p className="mt-4 font-body text-sm text-ink-soft">Carregando analistas...</p>}

      {erro && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 font-body text-sm text-red-700">
          {erro}
        </p>
      )}

      {mensagem && !editando && (
        <p role="status" className="mt-3 rounded-lg bg-forest-mist/60 p-3 font-body text-sm text-forest-deep">
          {mensagem}
        </p>
      )}

      {!carregando && !editando && (
        <>
          {analistas.length === 0 && !erro && (
            <p className="mt-4 font-body text-sm text-ink-soft">Nenhum analista ativo cadastrado.</p>
          )}

          {analistas.length > LIMITE_SEM_BUSCA && (
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar analista pelo nome"
              aria-label="Buscar analista pelo nome"
              className="mt-4 w-full rounded-lg border border-ink-soft/25 bg-white px-3.5 py-2.5 font-body text-sm text-ink outline-none focus:border-forest focus:ring-2 focus:ring-forest-mist sm:max-w-sm"
            />
          )}

          {analistas.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left font-body text-sm">
                <thead>
                  <tr className="border-b border-ink-soft/20 font-mono text-xs uppercase tracking-wide text-ink-soft">
                    <th className="py-2 pr-3 font-normal">Analista</th>
                    <th className="py-2 pr-3 font-normal">Indicadores liberados</th>
                    <th className="py-2 pr-3 font-normal">Situação</th>
                    <th className="w-24 py-2 font-normal" />
                  </tr>
                </thead>
                <tbody>
                  {analistasFiltrados.map((a) => {
                    const exc = excecoes[a.id]
                    const diferencas = exc ? Object.keys(exc).length : 0
                    const efetivos = efetivosDoAnalista(padrao, exc)
                    const liberados = Object.values(efetivos).filter(Boolean).length
                    return (
                      <tr key={a.id} className="border-b border-ink-soft/10">
                        <td className="py-3 pr-3">
                          <span className="block text-ink">{a.nome}</span>
                          <span className="block text-xs text-ink-soft">{a.email}</span>
                        </td>
                        <td className="py-3 pr-3 text-ink">
                          {liberados} de {totalCatalogo}
                        </td>
                        <td className="py-3 pr-3">
                          {diferencas === 0 ? (
                            <span className="text-ink-soft">Segue o padrão</span>
                          ) : (
                            <span className="rounded-full bg-brass-pale px-2.5 py-1 text-xs font-medium text-ink">
                              {diferencas} {diferencas === 1 ? 'diferença' : 'diferenças'} do padrão
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-right">
                          <Button variant="ghost" onClick={() => abrirEdicao(a)}>
                            Editar
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                  {analistasFiltrados.length === 0 && analistas.length > 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-ink-soft">
                        Nenhum analista encontrado para essa busca.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {editando && (
        <div className="mt-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="font-display text-base font-semibold text-ink">{editando.nome}</h3>
              <p className="font-body text-xs text-ink-soft">
                Indicadores destacados diferem do padrão. Ao salvar, só as diferenças são gravadas.
              </p>
            </div>
            <div className="w-full sm:w-64">
              <SelectField
                label="Copiar de"
                value={copiarDe}
                options={opcoesCopia}
                onChange={(e) => copiarDeOutroAnalista(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left font-body text-sm">
              <thead>
                <tr className="border-b border-ink-soft/20 font-mono text-xs uppercase tracking-wide text-ink-soft">
                  <th className="py-2 pr-3 font-normal">Indicador</th>
                  <th className="w-24 py-2 text-center font-normal">Padrão</th>
                  <th className="w-28 py-2 text-center font-normal">{editando.nome.split(' ')[0]}</th>
                </tr>
              </thead>
              <tbody>
                {CATALOGO_INDICADORES.map((ind) => {
                  const valorPadrao = padrao[ind.chave] ?? false
                  const valor = rascunho[ind.chave] ?? false
                  const diferente = valor !== valorPadrao
                  return (
                    <tr
                      key={ind.chave}
                      className={`border-b border-ink-soft/10 ${diferente ? 'bg-brass-pale/50' : ''}`}
                    >
                      <td className="py-3 pr-3">
                        <span className="block text-ink">{ind.nome}</span>
                        <span className="block text-xs text-ink-soft">{ind.descricao}</span>
                      </td>
                      <td className="py-3 text-center text-ink-soft">{valorPadrao ? 'Sim' : 'Não'}</td>
                      <td className="py-3 text-center">
                        <input
                          type="checkbox"
                          checked={valor}
                          onChange={(e) => alternar(ind.chave, e.target.checked)}
                          aria-label={`${ind.nome} para ${editando.nome}`}
                          className="h-4 w-4 rounded border-ink-soft/40 text-forest focus:ring-forest-mist"
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <Button variant="ghost" onClick={voltarAoPadrao} disabled={salvando}>
              Voltar ao padrão
            </Button>
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={fecharEdicao} disabled={salvando}>
                Cancelar
              </Button>
              <Button onClick={salvar} disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar liberação'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
