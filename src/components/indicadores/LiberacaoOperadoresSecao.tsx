// src/components/indicadores/LiberacaoOperadoresSecao.tsx
//
// Liberação de nível 2 dos Indicadores, na tela do Responsável (perfil
// 'gestor') do Cliente: ele marca, para cada Operador da própria empresa,
// quais indicadores aquela pessoa pode ver. Só aparecem os indicadores que o
// Administrador já liberou ao perfil Cliente (nível 1). O Responsável sempre
// vê todos os que o Administrador liberou.
//
// A seção não aparece para quem não é Responsável ativo (o banco devolve
// "sem acesso" e o componente não renderiza nada).

import { useEffect, useState } from 'react'
import { Button } from '../Button'
import { CATALOGO_INDICADORES } from '../../services/liberacaoIndicadoresService'
import {
  liberacaoOperadorService,
  type LiberacaoOperadores,
} from '../../services/liberacaoOperadorService'

export function LiberacaoOperadoresSecao() {
  const [dados, setDados] = useState<LiberacaoOperadores | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvoEm, setSalvoEm] = useState<Date | null>(null)

  useEffect(() => {
    liberacaoOperadorService
      .carregar()
      .then(setDados)
      .catch((e: unknown) => setErro(e instanceof Error ? e.message : 'Erro ao carregar a liberação.'))
      .finally(() => setCarregando(false))
  }, [])

  if (carregando) {
    return <p className="font-body text-sm text-ink-soft">Carregando liberação dos Operadores...</p>
  }

  // Não é Responsável ativo: a seção não se aplica.
  if (!dados && !erro) return null

  const indicadores = CATALOGO_INDICADORES.filter((ind) => dados?.indicadores.includes(ind.chave))

  function alternar(usuarioId: string, indicador: string, liberado: boolean) {
    setSalvoEm(null)
    setDados((atual) =>
      atual
        ? {
            ...atual,
            operadores: atual.operadores.map((op) =>
              op.usuarioId === usuarioId
                ? { ...op, liberacoes: { ...op.liberacoes, [indicador]: liberado } }
                : op,
            ),
          }
        : atual,
    )
  }

  async function salvar() {
    if (!dados) return
    setSalvando(true)
    setErro(null)
    try {
      for (const op of dados.operadores) {
        const liberacoes: Record<string, boolean> = {}
        for (const ind of indicadores) liberacoes[ind.chave] = op.liberacoes[ind.chave] ?? false
        await liberacaoOperadorService.salvar(op.usuarioId, liberacoes)
      }
      setSalvoEm(new Date())
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar a liberação.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <section className="rounded-xl border border-charcoal-3/10 bg-white p-6 shadow-soft">
      <h2 className="font-display text-lg font-semibold text-forest-deep">Indicadores dos Operadores</h2>
      <p className="mt-1 font-body text-sm text-ink-soft">
        Escolha quais indicadores cada Operador da sua empresa pode ver. Você sempre vê todos os
        indicadores disponíveis para a sua empresa.
      </p>

      {dados && dados.operadores.length === 0 && (
        <p className="mt-4 rounded-lg bg-forest-mist/40 p-3 font-body text-sm text-ink-soft">
          Sua empresa ainda não tem Operadores ativos. Quando houver, eles aparecerão aqui.
        </p>
      )}

      {dados && dados.operadores.length > 0 && indicadores.length === 0 && (
        <p className="mt-4 rounded-lg bg-forest-mist/40 p-3 font-body text-sm text-ink-soft">
          Nenhum indicador está disponível para a sua empresa no momento.
        </p>
      )}

      {dados && dados.operadores.length > 0 && indicadores.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left font-body text-sm">
            <thead>
              <tr className="border-b border-ink-soft/20 font-mono text-xs uppercase tracking-wide text-ink-soft">
                <th className="py-2 pr-3 font-normal">Indicador</th>
                {dados.operadores.map((op) => (
                  <th key={op.usuarioId} className="w-32 py-2 text-center font-normal normal-case">
                    <span className="block truncate" title={op.email}>
                      {op.nome}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {indicadores.map((ind) => (
                <tr key={ind.chave} className="border-b border-ink-soft/10">
                  <td className="py-3 pr-3">
                    <span className="block text-ink">{ind.nome}</span>
                    <span className="block text-xs text-ink-soft">{ind.descricao}</span>
                  </td>
                  {dados.operadores.map((op) => (
                    <td key={op.usuarioId} className="py-3 text-center">
                      <input
                        type="checkbox"
                        checked={op.liberacoes[ind.chave] ?? false}
                        onChange={(e) => alternar(op.usuarioId, ind.chave, e.target.checked)}
                        aria-label={`${ind.nome} para ${op.nome}`}
                        className="h-4 w-4 rounded border-ink-soft/40 text-forest focus:ring-forest-mist"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {erro && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 font-body text-sm text-red-700">
          {erro}
        </p>
      )}

      {dados && dados.operadores.length > 0 && indicadores.length > 0 && (
        <div className="mt-4 flex items-center justify-end gap-3">
          {salvoEm && (
            <span className="font-body text-sm text-forest">
              Liberação salva às {salvoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.
            </span>
          )}
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar liberação'}
          </Button>
        </div>
      )}
    </section>
  )
}
