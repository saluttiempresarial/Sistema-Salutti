// src/hooks/useLicitacoesInternas.ts
//
// Licitações ATIVAS (exclui ganho/perdido) da carteira de quem está logado
// como Administrador ou Funcionário, mais o mapa id -> nome do cliente.
// Respeita as permissões: funcionário com acesso restrito só recebe as
// licitações dos clientes vinculados a ele (mesma regra de usePermissoes).
//
// Serve ao cabeçalho (busca e sino), ao dashboard e ao calendário. Para não
// repetir a mesma consulta a cada componente da tela, o resultado fica em
// memória por 60 segundos (cache por usuário e por restrição de dados).
// Quem altera licitações deve chamar limparCacheLicitacoesInternas().

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { usePermissoes, type RestricaoDados } from '@/hooks/usePermissoes'
import { licitacaoService } from '@/services/licitacaoService'
import { clienteService } from '@/services/clienteService'
import type { Licitacao } from '@/types/licitacao'

const VALIDADE_MS = 60_000

interface Entrada<T> {
  criadoEm: number
  promessa: Promise<T>
}

const cacheAtivas = new Map<string, Entrada<Licitacao[]>>()
let cacheNomes: Entrada<Record<string, string>> | null = null

/** Descarta o cache — usar ao salvar/excluir licitação e ao sair do sistema. */
export function limparCacheLicitacoesInternas(): void {
  cacheAtivas.clear()
  cacheNomes = null
}

function buscarAtivas(chave: string, restricao: RestricaoDados): Promise<Licitacao[]> {
  const existente = cacheAtivas.get(chave)
  if (existente && Date.now() - existente.criadoEm < VALIDADE_MS) return existente.promessa

  const promessa = licitacaoService.listarAtivas(restricao)
  cacheAtivas.set(chave, { criadoEm: Date.now(), promessa })
  promessa.catch(() => cacheAtivas.delete(chave))
  return promessa
}

function buscarNomesClientes(): Promise<Record<string, string>> {
  if (cacheNomes && Date.now() - cacheNomes.criadoEm < VALIDADE_MS) return cacheNomes.promessa

  // 200 cobre a carteira inteira sem paginação — mesmo padrão já usado na
  // tela de Licitações e no seletor de cliente do cadastro.
  const promessa = clienteService.list({ page: 1, pageSize: 200 }).then((resultado) => {
    const mapa: Record<string, string> = {}
    resultado.data.forEach((c) => {
      mapa[c.id] = c.empresa.nomeFantasia
    })
    return mapa
  })
  const entrada = { criadoEm: Date.now(), promessa }
  cacheNomes = entrada
  promessa.catch(() => {
    if (cacheNomes === entrada) cacheNomes = null
  })
  return promessa
}

export function useLicitacoesInternas() {
  const { user } = useAuth()
  const { carregando: carregandoPermissoes, restricaoDados, podeAcessarModulo } = usePermissoes()
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([])
  const [nomesClientes, setNomesClientes] = useState<Record<string, string>>({})
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(false)

  const chave = `${user?.id ?? 'anonimo'}:${JSON.stringify(restricaoDados ?? {})}`

  useEffect(() => {
    if (carregandoPermissoes) return
    let ativo = true
    setCarregando(true)
    setErro(false)

    Promise.all([buscarAtivas(chave, restricaoDados ?? {}), buscarNomesClientes()])
      .then(([ativas, nomes]) => {
        if (!ativo) return
        setLicitacoes(ativas)
        setNomesClientes(nomes)
        setCarregando(false)
      })
      .catch(() => {
        if (!ativo) return
        setLicitacoes([])
        setErro(true)
        setCarregando(false)
      })

    return () => {
      ativo = false
    }
    // `chave` já resume `restricaoDados` e o usuário.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregandoPermissoes, chave])

  return {
    licitacoes,
    nomesClientes,
    carregando: carregando || carregandoPermissoes,
    erro,
    podeEditar: podeAcessarModulo('licitacoes', 'editar'),
    podeVerLicitacoes: podeAcessarModulo('licitacoes'),
  }
}
