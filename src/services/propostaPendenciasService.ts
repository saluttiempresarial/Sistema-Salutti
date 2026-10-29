import { supabase } from '@/lib/supabaseClient'
import { tipoDoObjeto } from '../types/licitacao'
import type { FaltaIdentificacao } from '../utils/propostaPendencias'

/**
 * Itens com valor preenchido e sem marca e/ou modelo, por licitação — para o
 * alerta "Falta marca/modelo" na lista de Licitações (a listagem não carrega
 * os itens, só o total). Só os itens com valor preenchido são lidos.
 * Licitação de Serviços (objeto "Serviços") exige categoria do serviço no
 * lugar de marca e modelo (migração 061).
 */

interface ItemPendenteRow {
  id: string
  licitacao_id: string
  proposta_marca: string | null
  proposta_modelo: string | null
  proposta_categoria_servico: string | null
}

/** licitacaoId -> lista do que falta em cada item pendente. Licitações sem
 *  pendência não aparecem no resultado. */
async function faltasPorLicitacao(
  licitacoes: Array<{ id: string; objeto?: string | null }>
): Promise<Record<string, FaltaIdentificacao[]>> {
  if (licitacoes.length === 0) return {}
  const licitacaoIds = licitacoes.map((l) => l.id)
  const idsServicos = new Set(licitacoes.filter((l) => tipoDoObjeto(l.objeto) === 'servicos').map((l) => l.id))

  const mapa: Record<string, FaltaIdentificacao[]> = {}
  const TAMANHO_PAGINA = 1000
  let inicio = 0

  // Lê só os itens com valor preenchido, em páginas, porque o banco devolve no
  // máximo 1000 linhas por consulta e uma página de licitações pode ter mais.
  for (;;) {
    const { data, error } = await supabase
      .from('itens_licitacao')
      .select('id, licitacao_id, proposta_marca, proposta_modelo, proposta_categoria_servico')
      .in('licitacao_id', licitacaoIds)
      .not('proposta_preco_minimo', 'is', null)
      .order('id', { ascending: true })
      .range(inicio, inicio + TAMANHO_PAGINA - 1)
    if (error) throw new Error(`Não foi possível verificar marca e modelo dos itens: ${error.message}`)

    const linhas = (data ?? []) as ItemPendenteRow[]
    for (const row of linhas) {
      let falta: FaltaIdentificacao | null
      if (idsServicos.has(row.licitacao_id)) {
        falta = (row.proposta_categoria_servico ?? '').trim() ? null : 'categoria'
      } else {
        const semMarca = !(row.proposta_marca ?? '').trim()
        const semModelo = !(row.proposta_modelo ?? '').trim()
        falta = semMarca && semModelo ? 'marca_modelo' : semMarca ? 'marca' : semModelo ? 'modelo' : null
      }
      if (!falta) continue
      if (!mapa[row.licitacao_id]) mapa[row.licitacao_id] = []
      mapa[row.licitacao_id].push(falta)
    }

    if (linhas.length < TAMANHO_PAGINA) break
    inicio += TAMANHO_PAGINA
  }

  return mapa
}

export const propostaPendenciasService = { faltasPorLicitacao }
