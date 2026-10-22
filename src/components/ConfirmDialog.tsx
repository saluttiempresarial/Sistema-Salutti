import { Modal } from '@/components/Modal'
import { Button } from '@/components/Button'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  isLoading?: boolean
  /** 'danger' (vermelho, padrão — ações destrutivas) ou 'success' (verde — ações positivas, como liberar). */
  variant?: 'danger' | 'success'
  /** Texto do botão enquanto processa. Padrão: "Excluindo…". */
  loadingLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

/** Diálogo de confirmação genérico — usado hoje para excluir clientes,
 *  reutilizável por qualquer outra ação destrutiva do sistema. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  isLoading = false,
  variant = 'danger',
  loadingLabel = 'Excluindo…',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className={
              variant === 'success'
                ? 'bg-green-600 hover:bg-green-700 focus-visible:outline-green-600 disabled:bg-green-600/50'
                : 'bg-red-600 hover:bg-red-700 focus-visible:outline-red-600 disabled:bg-red-600/50'
            }
          >
            {isLoading ? loadingLabel : confirmLabel}
          </Button>
        </>
      }
    >
      <p className="font-body text-sm text-ink-soft">{description}</p>
    </Modal>
  )
}
