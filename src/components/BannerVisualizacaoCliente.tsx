// src/components/BannerVisualizacaoCliente.tsx
//
// Faixa fixa no topo enquanto o Administrador vê o portal de um cliente
// ("Ver como cliente", 09/11/2026). Mostra de quem é o portal, avisa que é só
// consulta e traz o botão para sair da visualização.
//
// A altura da faixa vai para a variável CSS --faixa-visualizacao, usada pelo
// cabeçalho e pelo menu lateral do portal para não ficarem escondidos sob ela.

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export function BannerVisualizacaoCliente() {
  const { visualizacaoCliente, sairVisualizacaoCliente } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    document.documentElement.style.setProperty('--faixa-visualizacao', visualizacaoCliente ? '2.5rem' : '0px')
    return () => document.documentElement.style.setProperty('--faixa-visualizacao', '0px')
  }, [visualizacaoCliente])

  if (!visualizacaoCliente) return null

  function sair() {
    sairVisualizacaoCliente()
    navigate('/admin/clientes', { replace: true })
  }

  return (
    <div
      role="status"
      className="sticky top-0 z-[45] flex h-10 items-center justify-center gap-3 bg-brass px-4 font-body text-sm text-white shadow-soft"
    >
      <span className="truncate">
        <strong>Você está visualizando como {visualizacaoCliente.nome}</strong>
        <span className="hidden sm:inline"> — somente consulta, nada é salvo.</span>
      </span>
      <button
        type="button"
        onClick={sair}
        className="shrink-0 rounded-md bg-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/30"
      >
        Sair da visualização
      </button>
    </div>
  )
}
