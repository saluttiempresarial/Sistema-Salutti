// src/components/Modal.tsx
//
// Componente genérico de modal, usado por várias telas do sistema
// (ConfirmDialog, formulário de clientes, LicitacaoFormModal, DisputaFormModal
// etc.) — qualquer mudança aqui afeta todos eles.
//
// Tamanho "full" adicionado em 25/09 a pedido do Márcio, especificamente
// para o LicitacaoFormModal (formulário ganhou 7 abas com o checklist de
// exigências, e "xl" ficava apertado demais). Os tamanhos existentes
// (md/lg/xl) não foram alterados — nenhuma outra tela muda de aparência.
import type { ReactNode } from 'react'
import { useEffect } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  size?: 'md' | 'lg' | 'xl' | 'full'
  footer?: ReactNode
}

const SIZE_CLASSES: Record<NonNullable<ModalProps['size']>, string> = {
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  // Praticamente a tela toda, com uma margem pequena (mesma folga aplicada
  // pelo px-4/py-8 do overlay) — não é 100vw/100vh "cru" porque aí a
  // sombra/cantos arredondados do modal encostariam nas bordas da janela.
  full: 'max-w-[95vw] h-[92vh]',
}

/** Overlay/modal genérico usado por ConfirmDialog e pelo formulário de clientes.
 *  Fecha com Esc e ao clicar fora do conteúdo. */
export function Modal({ open, onClose, title, subtitle, children, size = 'md', footer }: ModalProps) {
  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/50 px-4 py-8"
      onClick={onClose}
    >
      <div
        className={`flex max-h-full w-full flex-col rounded-2xl bg-white shadow-card ${SIZE_CLASSES[size]}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="flex items-start justify-between border-b border-ink-soft/10 px-6 py-5">
          <div>
            <h2 id="modal-title" className="font-display text-lg font-semibold text-forest-deep">
              {title}
            </h2>
            {subtitle && <p className="mt-1 font-body text-sm text-ink-soft">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-ink-soft transition-colors hover:bg-forest-mist hover:text-forest-deep"
          >
            ✕
          </button>
        </div>

        {/* flex-1 + min-h-0: essencial para o tamanho "full" — é o que faz
            esta área ocupar o espaço vertical restante do modal (que agora
            tem altura fixa, h-[92vh]) e rolar dentro dela, em vez de a
            altura do modal só seguir o tamanho do conteúdo. Não muda nada
            nos tamanhos md/lg/xl, que não têm altura fixa. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-3 border-t border-ink-soft/10 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
