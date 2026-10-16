// src/components/StatusPill.tsx
//
// Badge de status genérico, com "tom" (cor) configurável — usado para os
// status de Licitações/Propostas/Disputas, que têm 5+ variações (pendente,
// em análise, enviado, ganho, perdido, etc.), diferente do StatusBadge real
// do projeto (que é binário: só "ativo"/"inativo", usado em Clientes e
// Funcionários). Por isso este componente tem um NOME DIFERENTE — não deve
// substituir nem ser confundido com `components/StatusBadge.tsx` original.
//
// Cores (15/10, redesenho do painel): neutro em cinza, "info" (Em análise)
// em azul, "warning" (Enviado) em dourado, ganho em verde e perdido em
// vermelho — antes "info" e "success" eram dois verdes quase iguais.

export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

interface StatusPillProps {
  label: string;
  tone: StatusTone;
}

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: 'bg-slate-100 text-slate-600',
  success: 'bg-forest-mist text-forest-deep',
  warning: 'bg-brass-pale text-brass',
  danger: 'bg-red-50 text-red-700',
  info: 'bg-sky-50 text-sky-700',
};

export function StatusPill({ label, tone }: StatusPillProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 font-body text-xs font-medium ${TONE_CLASSES[tone]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {label}
    </span>
  );
}
