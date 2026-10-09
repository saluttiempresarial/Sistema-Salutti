// src/components/ClienteSidebar.tsx
//
// Menu lateral fixo do Portal do Cliente — mesmo padrão visual do
// AdminSidebar.tsx (foto de perfil + itens de navegação), com os 3 itens
// que o Márcio pediu: Licitações, Calendário, Relatórios.
//
// Ícones são SVGs simples desenhados à mão, iguais aos do AdminSidebar —
// evita precisar rodar npm install para esta mudança.

import { useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { usuarioClienteService } from '@/services/usuarioClienteService'
import { ROLE_LABEL } from '@/types/auth'
import { FotoPerfilCropModal } from './FotoPerfilCropModal'

interface ItemMenu {
  label: string
  to: string
  icon: ReactElement
}

function IconDocumento() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4" />
      <path d="M9 13l2 2 4-4" />
    </svg>
  )
}

function IconCalendario() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17" />
      <path d="M8 3v4M16 3v4" />
    </svg>
  )
}

function IconGrafico() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <path d="M4 20V10" />
      <path d="M11 20V4" />
      <path d="M18 20v-7" />
      <path d="M3 20h18" />
    </svg>
  )
}

const ITENS: ItemMenu[] = [
  { label: 'Licitações', to: '/cliente', icon: <IconDocumento /> },
  { label: 'Calendário', to: '/cliente/calendario', icon: <IconCalendario /> },
  { label: 'Relatórios', to: '/cliente/relatorios', icon: <IconGrafico /> },
  { label: 'Indicadores', to: '/cliente/indicadores', icon: <IconGrafico /> },
]

export function ClienteSidebar() {
  const { user } = useAuth()
  const location = useLocation()

  const iniciais = (user?.name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join('')

  const [fotoUrl, setFotoUrl] = useState<string | undefined>(undefined)
  const [enviandoFoto, setEnviandoFoto] = useState(false)
  const inputFotoRef = useRef<HTMLInputElement>(null)
  // Arquivo escolhido no input, aguardando enquadramento no
  // FotoPerfilCropModal — só some (volta a null) ao cancelar ou confirmar
  // o recorte, mesmo comportamento já usado no AdminSidebar.
  const [arquivoParaRecortar, setArquivoParaRecortar] = useState<File | null>(null)

  useEffect(() => {
    if (!user?.usuarioClienteId) return
    let ativo = true
    usuarioClienteService.buscarFotoPropria(user.usuarioClienteId).then((url) => {
      if (ativo) setFotoUrl(url)
    })
    return () => {
      ativo = false
    }
  }, [user?.usuarioClienteId])

  function handleSelecionarFoto(event: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0]
    event.target.value = '' // permite escolher o mesmo arquivo de novo depois de cancelar
    if (!arquivo) return
    setArquivoParaRecortar(arquivo)
  }

  async function handleConfirmarRecorte(arquivoRecortado: File) {
    setArquivoParaRecortar(null)
    if (!user) return
    setEnviandoFoto(true)
    try {
      const url = await usuarioClienteService.uploadFoto(user.id, arquivoRecortado)
      setFotoUrl(url)
    } finally {
      setEnviandoFoto(false)
    }
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col bg-forest-deep">
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-6">
        <button
          type="button"
          onClick={() => inputFotoRef.current?.click()}
          disabled={enviandoFoto}
          aria-label={fotoUrl ? 'Trocar foto de perfil' : 'Adicionar foto de perfil'}
          className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-white/15 disabled:opacity-60"
        >
          {fotoUrl ? (
            <img src={fotoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center font-body text-sm font-semibold text-white">
              {iniciais || '—'}
            </span>
          )}
        </button>
        <input
          ref={inputFotoRef}
          type="file"
          accept="image/*"
          onChange={handleSelecionarFoto}
          className="hidden"
        />
        <div>
          <p className="font-body text-sm font-semibold text-white">{user?.name ?? '—'}</p>
          <p className="font-mono text-[11px] uppercase tracking-wide text-white/60">
            {user ? ROLE_LABEL[user.role] : ''}
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {ITENS.map((item) => {
          const ativo = location.pathname === item.to
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 font-body text-sm transition-colors ${
                ativo ? 'bg-white/15 font-medium text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          )
        })}
      </nav>

      <FotoPerfilCropModal
        arquivo={arquivoParaRecortar}
        onCancelar={() => setArquivoParaRecortar(null)}
        onConfirmar={handleConfirmarRecorte}
      />
    </aside>
  )
}
