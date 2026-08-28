// src/utils/prazoUtils.ts
//
// Regra de negócio do Capítulo 6 do PRD: prazo interno = N dias úteis
// antes da licitação, a uma hora fixa. N e a hora são configuráveis pelo
// Administrador (ver Configurações do sistema / configuracaoService.ts) —
// o padrão de fábrica é 3 dias úteis, 18h. Centralizado aqui para não
// duplicar a lógica em cada tela que precisar exibir ou validar o prazo.
//
// CACHE EM MEMÓRIA: com a regra vindo do Supabase (configuracaoService),
// buscá-la não é mais síncrono como era com localStorage. Para não obrigar
// todo lugar que usa calcularPrazoInterno/classificarUrgenciaPrazo (várias
// telas, chamados de forma síncrona dentro de useMemo/JSX) a virar
// assíncrono, a regra é buscada UMA VEZ do banco e mantida em cache neste
// módulo. Chame carregarRegraPrazoCache() uma vez no carregamento do app
// (ex.: em App.tsx, dentro de um useEffect no componente raiz) para
// popular o cache com o valor real assim que possível. Antes disso (ou se
// a busca falhar), os cálculos usam o padrão de fábrica (3 dias úteis,
// 18h) como fallback — nunca ficam sem funcionar.

import { configuracaoService } from '../services/configuracaoService';
import type { RegraPrazoInterno } from '../types/configuracoes';

const REGRA_PADRAO: RegraPrazoInterno = { diasUteisAntes: 3, horario: '18:00' };

let regraCache: RegraPrazoInterno = REGRA_PADRAO;

/** Busca a regra de prazo real no Supabase e atualiza o cache em memória.
 *  Chamar uma vez no carregamento do app (ex.: App.tsx). Também deve ser
 *  chamada de novo depois que o Administrador salvar uma nova regra em
 *  Configurações, para o cache não ficar desatualizado na mesma sessão. */
export async function carregarRegraPrazoCache(): Promise<void> {
  try {
    regraCache = await configuracaoService.obterRegraPrazo();
  } catch {
    // Mantém o padrão de fábrica se a busca falhar (ex.: sem conexão) —
    // os cálculos de prazo continuam funcionando com o valor de fallback.
  }
}

/** Retorna true se a data (0 = domingo, 6 = sábado) cair em dia útil. */
function isDiaUtil(date: Date): boolean {
  const dia = date.getDay();
  return dia !== 0 && dia !== 6;
}

/** Subtrai N dias úteis de uma data, pulando sábados e domingos. */
export function subtrairDiasUteis(data: Date, dias: number): Date {
  const resultado = new Date(data);
  let restantes = dias;
  while (restantes > 0) {
    resultado.setDate(resultado.getDate() - 1);
    if (isDiaUtil(resultado)) {
      restantes -= 1;
    }
  }
  return resultado;
}

/**
 * Calcula o prazo interno da Salutti para uma licitação: N dias úteis antes
 * da data/hora da sessão, fixado na hora configurada (padrão: 3 dias úteis
 * antes, 18h — ajustável em Configurações). Usa o cache em memória — ver
 * nota no topo do arquivo.
 */
export function calcularPrazoInterno(dataAberturaSessaoISO: string): Date {
  const { diasUteisAntes, horario } = regraCache;
  const [hora, minuto] = horario.split(':').map(Number);

  const sessao = new Date(dataAberturaSessaoISO);
  const prazo = subtrairDiasUteis(sessao, diasUteisAntes);
  prazo.setHours(hora, minuto, 0, 0);
  return prazo;
}

export type UrgenciaPrazo = 'ok' | 'atencao' | 'vencido';

/**
 * Classifica a urgência do prazo interno em relação a agora:
 * - "vencido": já passou do prazo interno
 * - "atencao": faltam 24h ou menos para o prazo interno
 * - "ok": ainda há folga
 */
export function classificarUrgenciaPrazo(dataAberturaSessaoISO: string, agora: Date = new Date()): UrgenciaPrazo {
  const prazo = calcularPrazoInterno(dataAberturaSessaoISO);
  const diffHoras = (prazo.getTime() - agora.getTime()) / (1000 * 60 * 60);

  if (diffHoras < 0) return 'vencido';
  if (diffHoras <= 24) return 'atencao';
  return 'ok';
}

export function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
