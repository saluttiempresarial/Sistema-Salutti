// src/components/indicadores/LiberacaoIndicadoresSecao.tsx
//
// Seção de Configurações: liberação de nível 1 dos Indicadores. O Administrador
// marca, para cada indicador, se o Analista e o Cliente podem vê-lo. A regra é
// igual para todos os clientes. O Administrador sempre vê todos.

import { useEffect, useState } from 'react'
import { Button } from '../Button'
import {
  CATALOGO_INDICADORES,
  PERFIS_LIBERACAO,
  liberacaoIndicadoresService,
  type LiberacaoIndicadores,
  type PerfilLiberacao,
} from '../../services/liberacaoIndicadoresService'

export function LiberacaoIndicadoresSecao() {
  const [liberacao, setLiberacao] = useState<LiberacaoIndicadores | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvoEm, setSalvoEm] = useState<Date | null>(null)

  useEffect(() => {
    liberacaoIndicadoresService
      .listar()
      .then(setLiberacao)
      .catch((e: unknown) => setErro(e instanceof Error ? e.message : 'Erro ao carregar a liberação.'))
      .finally(() => setCarregando(false))
  }, [])

  function alternar(indicador: string, perfil: PerfilLiberacao, liberado: boolean) {
    setSalvoEm(null)
    setLiberacao((atual) =>
      atual ? { ...atual, [indicador]: { ...atual[indicador], [perfil]: liberado } } : atual,
    )
  }

  async function salvar() {
    if (!liberacao) return
    setSalvando(true)
    setErro(null)
    try {
      await liberacaoIndicadoresService.salvar(liberacao)
      setSalvoEm(new Date())
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar a liberação.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <section className="rounded-xl border border-charcoal-3/10 bg-white p-6 shadow-soft">
      <h2 className="font-display text-lg font-semibold text-forest-deep">Liberação de Indicadores</h2>
      <p className="mt-1 font-body text-sm text-ink-soft">
        Escolha quais indicadores cada perfil pode ver. A regra vale para todos os clientes, e o
        Administrador sempre vê todos. Indicadores desligados aqui também ficam fechados para os
        usuários do cliente, mesmo que o Responsável tenha liberado.
      </p>

      {carregando && <p className="mt-4 font-body text-sm text-ink-soft">Carregando liberação...</p>}

      {liberacao && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left font-body text-sm">
            <thead>
              <tr className="border-b border-ink-soft/20 font-mono text-xs uppercase tracking-wide text-ink-soft">
                <th className="py-2 pr-3 font-normal">Indicador</th>
                {PERFIS_LIBERACAO.map((p) => (
                  <th key={p.chave} className="w-28 py-2 text-center font-normal">
                    {p.rotulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CATALOGO_INDICADORES.map((ind) => (
                <tr key={ind.chave} className="border-b border-ink-soft/10">
                  <td className="py-3 pr-3">
                    <span className="block text-ink">{ind.nome}</span>
                    <span className="block text-xs text-ink-soft">{ind.descricao}</span>
                  </td>
                  {PERFIS_LIBERACAO.map((p) => (
                    <td key={p.chave} className="py-3 text-center">
                      <input
                        type="checkbox"
                        checked={liberacao[ind.chave]?.[p.chave] ?? false}
                        onChange={(e) => alternar(ind.chave, p.chave, e.target.checked)}
                        aria-label={`${ind.nome} para ${p.rotulo}`}
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

      {liberacao && (
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
