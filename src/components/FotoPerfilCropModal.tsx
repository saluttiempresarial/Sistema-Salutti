// src/components/FotoPerfilCropModal.tsx
//
// Modal de enquadramento da foto de perfil — a pedido do Márcio (30/09):
// antes, a foto escolhida ia direto pro upload e o CSS (object-cover)
// decidia sozinho qual parte cortar, sem o usuário poder escolher/mover.
// Agora, depois de selecionar o arquivo, abre este modal pra arrastar a
// foto e dar zoom até enquadrar do jeito que quiser, ANTES de confirmar o
// upload.
//
// Sem nenhuma biblioteca nova (mesma decisão já tomada nos ícones do
// AdminSidebar) — usa só <canvas> e Pointer Events nativos do navegador:
// - Arrastar: reposiciona a foto dentro do círculo de enquadramento.
// - Slider de zoom: amplia, mantendo centralizado o ponto que estava no
//   meio do círculo antes de mexer.
// - Confirmar: desenha só a área visível dentro do círculo num canvas
//   quadrado (320x320) e gera um novo arquivo (JPEG) — é esse arquivo que
//   sobe pro Supabase Storage, no lugar do arquivo original inteiro.
//
// O círculo de enquadramento aqui é só um guia visual (o avatar real já é
// recortado em círculo via CSS, rounded-full) — o arquivo exportado é um
// quadrado normal.

import { useEffect, useRef, useState } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'

const CAIXA = 280 // tamanho (px) da área de enquadramento mostrada na tela
const SAIDA = 320 // tamanho (px) da imagem exportada (quadrada)
const ZOOM_MIN = 1
const ZOOM_MAX = 3

interface FotoPerfilCropModalProps {
  arquivo: File | null
  onCancelar: () => void
  onConfirmar: (arquivoRecortado: File) => void
}

interface Offset {
  x: number
  y: number
}

export function FotoPerfilCropModal({ arquivo, onCancelar, onConfirmar }: FotoPerfilCropModalProps) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [urlObjeto, setUrlObjeto] = useState<string | null>(null)
  const [tamanhoNatural, setTamanhoNatural] = useState<{ w: number; h: number } | null>(null)
  const [zoom, setZoom] = useState(ZOOM_MIN)
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 })
  const arrastoRef = useRef<{ clienteX: number; clienteY: number; offsetX: number; offsetY: number } | null>(null)

  // Cria/revoga a URL do arquivo selecionado — some assim que o modal
  // fecha ou troca de arquivo, pra não vazar memória.
  useEffect(() => {
    if (!arquivo) {
      setUrlObjeto(null)
      return
    }
    const url = URL.createObjectURL(arquivo)
    setUrlObjeto(url)
    setTamanhoNatural(null)
    setZoom(ZOOM_MIN)
    setOffset({ x: 0, y: 0 })
    return () => URL.revokeObjectURL(url)
  }, [arquivo])

  function escalaBase(natural: { w: number; h: number }): number {
    return CAIXA / Math.min(natural.w, natural.h)
  }

  function limitar(valor: Offset, escala: number, natural: { w: number; h: number }): Offset {
    const dispW = natural.w * escala
    const dispH = natural.h * escala
    const minX = Math.min(0, CAIXA - dispW)
    const minY = Math.min(0, CAIXA - dispH)
    return {
      x: Math.min(0, Math.max(minX, valor.x)),
      y: Math.min(0, Math.max(minY, valor.y)),
    }
  }

  function handleImagemCarregada() {
    const img = imgRef.current
    if (!img) return
    const natural = { w: img.naturalWidth, h: img.naturalHeight }
    setTamanhoNatural(natural)
    const escala = escalaBase(natural)
    const centralizado = { x: (CAIXA - natural.w * escala) / 2, y: (CAIXA - natural.h * escala) / 2 }
    setOffset(limitar(centralizado, escala, natural))
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!tamanhoNatural) return
    ;(e.target as Element).setPointerCapture(e.pointerId)
    arrastoRef.current = { clienteX: e.clientX, clienteY: e.clientY, offsetX: offset.x, offsetY: offset.y }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const inicio = arrastoRef.current
    if (!inicio || !tamanhoNatural) return
    const escala = escalaBase(tamanhoNatural) * zoom
    const novo = {
      x: inicio.offsetX + (e.clientX - inicio.clienteX),
      y: inicio.offsetY + (e.clientY - inicio.clienteY),
    }
    setOffset(limitar(novo, escala, tamanhoNatural))
  }

  function handlePointerUp() {
    arrastoRef.current = null
  }

  function handleZoom(novoZoom: number) {
    if (!tamanhoNatural) {
      setZoom(novoZoom)
      return
    }
    const base = escalaBase(tamanhoNatural)
    const escalaAntiga = base * zoom
    const escalaNova = base * novoZoom
    // Mantém centralizado, ao dar zoom, o mesmo ponto da foto que estava
    // no meio do círculo — sem isso, cada arrasto do slider "chutaria" a
    // foto pro canto.
    const dispWAntigo = tamanhoNatural.w * escalaAntiga
    const dispHAntigo = tamanhoNatural.h * escalaAntiga
    const ax = (CAIXA / 2 - offset.x) / dispWAntigo
    const ay = (CAIXA / 2 - offset.y) / dispHAntigo
    const dispWNovo = tamanhoNatural.w * escalaNova
    const dispHNovo = tamanhoNatural.h * escalaNova
    const novo = { x: CAIXA / 2 - ax * dispWNovo, y: CAIXA / 2 - ay * dispHNovo }
    setZoom(novoZoom)
    setOffset(limitar(novo, escalaNova, tamanhoNatural))
  }

  function handleConfirmar() {
    const img = imgRef.current
    if (!img || !tamanhoNatural) return
    const escala = escalaBase(tamanhoNatural) * zoom

    const canvas = document.createElement('canvas')
    canvas.width = SAIDA
    canvas.height = SAIDA
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Área visível dentro do círculo, convertida de volta pras coordenadas
    // originais (em pixels) da foto.
    const sx = -offset.x / escala
    const sy = -offset.y / escala
    const sTamanho = CAIXA / escala
    ctx.drawImage(img, sx, sy, sTamanho, sTamanho, 0, 0, SAIDA, SAIDA)

    canvas.toBlob(
      (blob) => {
        if (!blob) return
        onConfirmar(new File([blob], 'foto-perfil.jpg', { type: 'image/jpeg' }))
      },
      'image/jpeg',
      0.92
    )
  }

  const escalaAtual = tamanhoNatural ? escalaBase(tamanhoNatural) * zoom : 1

  return (
    <Modal
      open={!!arquivo}
      onClose={onCancelar}
      title="Ajustar foto de perfil"
      subtitle="Arraste a foto para posicionar e use o controle de zoom para enquadrar."
      footer={
        <>
          <Button variant="ghost" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmar} disabled={!tamanhoNatural}>
            Confirmar
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-4">
        <div
          className="relative overflow-hidden rounded-full border-2 border-forest bg-paper-2 shadow-inner"
          style={{ width: CAIXA, height: CAIXA, touchAction: 'none', cursor: tamanhoNatural ? 'grab' : 'default' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {urlObjeto && (
            // eslint-disable-next-line jsx-a11y/alt-text
            <img
              ref={imgRef}
              src={urlObjeto}
              onLoad={handleImagemCarregada}
              draggable={false}
              className="absolute left-0 top-0 max-w-none select-none"
              style={{
                width: tamanhoNatural ? tamanhoNatural.w * escalaAtual : undefined,
                height: tamanhoNatural ? tamanhoNatural.h * escalaAtual : undefined,
                transform: `translate(${offset.x}px, ${offset.y}px)`,
              }}
            />
          )}
        </div>

        <div className="flex w-full max-w-xs items-center gap-3">
          <span className="font-body text-xs text-ink-soft">Zoom</span>
          <input
            type="range"
            min={ZOOM_MIN}
            max={ZOOM_MAX}
            step={0.01}
            value={zoom}
            onChange={(e) => handleZoom(Number(e.target.value))}
            disabled={!tamanhoNatural}
            className="flex-1"
          />
        </div>
      </div>
    </Modal>
  )
}
