// src/components/dashboard/CartoesPrazos.tsx
//
// Dois cartões de prazo da tela inicial interna (Administrador e Funcionário),
// separados a pedido do Márcio (04/11):
//   - "Prazos vencidos": o prazo interno já passou — o cliente não consegue
//     mais mexer na proposta, a menos que a equipe libere um novo prazo;
//   - "Prazos próximos": ainda não venceram, mas vencem até o fim do próximo
//     dia útil (regra em prazoUtils.classificarUrgenciaPrazo).
// Cada cartão soma as licitações com as ações pendentes da disputa de mesma
// situação. Ação pendente sem prazo informado não entra em nenhum dos dois
// (continua aparecendo no sino).

import { useMemo } from 'react'
import type { Licitacao } from '@/types/licitacao'
import type { AlertaAcaoDisputa } from '@/utils/acoesDisputa'
import { classificarUrgenciaPrazo } from '@/utils/prazoUtils'
import { CartaoResumo } from '@/components/dashboard/CartaoResumo'
import { IconeAlerta, IconeCalendarioRelogio } from '@/components/icones'

interface CartoesPrazosProps {
  licitacoes: Licitacao[]
  acoes: AlertaAcaoDisputa[]
  carregando: boolean
  /** Tela para onde os cartões levam ao clicar. */
  to: string
}

// Legenda: a explicação do cartão, ou a divisão entre licitações e ações da disputa.
function legenda(explicacao: string, licitacoes: number, acoes: number): string {
  if (acoes === 0) return explicacao
  const ac = `${acoes} ${acoes === 1 ? 'ação da disputa' : 'ações da disputa'}`
  return licitacoes === 0 ? ac : `${licitacoes} ${licitacoes === 1 ? 'licitação' : 'licitações'} · ${ac}`
}

export function CartoesPrazos({ licitacoes, acoes, carregando, to }: CartoesPrazosProps) {
  const { vencidas, proximas } = useMemo(() => {
    let v = 0
    let p = 0
    licitacoes.forEach((l) => {
      const urgencia = classificarUrgenciaPrazo(l.dataEfetivaLicitacao || l.dataLicitacao)
      if (urgencia === 'vencido') v += 1
      else if (urgencia === 'atencao') p += 1
    })
    return { vencidas: v, proximas: p }
  }, [licitacoes])

  const acoesVencidas = acoes.filter((a) => a.situacao === 'vencida').length
  const acoesProximas = acoes.filter((a) => a.situacao === 'proxima').length

  return (
    <>
      <CartaoResumo
        titulo="Prazos vencidos"
        valor={carregando ? '—' : String(vencidas + acoesVencidas)}
        legenda={legenda('o cliente não altera mais', vencidas, acoesVencidas)}
        icone={<IconeAlerta className="h-8 w-8" />}
        tom="vermelho"
        to={to}
      />
      <CartaoResumo
        titulo="Prazos próximos"
        valor={carregando ? '—' : String(proximas + acoesProximas)}
        legenda={legenda('vencem até o próximo dia útil', proximas, acoesProximas)}
        icone={<IconeCalendarioRelogio className="h-8 w-8" />}
        tom="dourado"
        to={to}
      />
    </>
  )
}
