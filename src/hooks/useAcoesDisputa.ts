// src/hooks/useAcoesDisputa.ts
//
// Alertas das ações pendentes das disputas (prazo vencido, próximo ou não
// informado) para o sino e para a tela inicial. Só carrega para quem pode ver
// o módulo Disputas e respeita a carteira do funcionário (mesma regra da tela
// de Disputas). O resultado fica em memória por 60 segundos, como em
// useLicitacoesInternas, para não repetir a consulta em cada componente.

import { useEffect, useState } from 'react'
import { usePermissoes, type RestricaoDados } from '@/hooks/usePermissoes'
import { disputaService } from '@/services/disputaService'
import { licitacaoService } from '@/services/licitacaoService'
import { alertasDeAcoesDisputa, type AlertaAcaoDisputa } from '@/utils/acoesDisputa'

const VALIDADE_MS = 60_000

interface Entrada {
  criadoEm: number
  promessa: Promise<AlertaAcaoDisputa[]>
}

const cache = new Map<string, Entrada>()

/** Descarta o cache — usar ao salvar uma disputa e ao sair do sistema. */
export function limparCacheAcoesDisputa(): void {
  cache.clear()
}

function buscar(chave: string, restricao: RestricaoDados | undefined): Promise<AlertaAcaoDisputa[]> {
  const existente = cache.get(chave)
  if (existente && Date.now() - existente.criadoEm < VALIDADE_MS) return existente.promessa

  const promessa = Promise.all([
    disputaService.listarTodas(),
    licitacaoService.listar({ pageSize: 1000, ...restricao }),
  ]).then(([disputas, licitacoes]) => {
    const mapa = new Map(licitacoes.itens.map((l) => [l.id, l]))
    // Só disputas de licitações que o usuário pode ver (carteira do funcionário).
    return alertasDeAcoesDisputa(
      disputas.filter((d) => mapa.has(d.licitacaoId)),
      mapa
    )
  })
  cache.set(chave, { criadoEm: Date.now(), promessa })
  promessa.catch(() => cache.delete(chave))
  return promessa
}

export function useAcoesDisputa() {
  const { carregando: carregandoPermissoes, ehAdmin, podeAcessarModulo, restricaoDados } = usePermissoes()
  const [alertas, setAlertas] = useState<AlertaAcaoDisputa[]>([])
  const [carregando, setCarregando] = useState(true)

  const permitido = ehAdmin || podeAcessarModulo('disputas')
  const chave = JSON.stringify(restricaoDados ?? 'total')

  useEffect(() => {
    if (carregandoPermissoes) return
    if (!permitido) {
      setAlertas([])
      setCarregando(false)
      return
    }
    let ativo = true
    setCarregando(true)
    buscar(chave, restricaoDados)
      .then((lista) => {
        if (ativo) setAlertas(lista)
      })
      .catch(() => {
        // Alerta é auxiliar: se a consulta falhar, o sino segue com o resto.
        if (ativo) setAlertas([])
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })
    return () => {
      ativo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregandoPermissoes, permitido, chave])

  return { alertas, carregando, permitido }
}
