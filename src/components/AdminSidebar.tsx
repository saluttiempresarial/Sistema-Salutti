// src/components/AdminSidebar.tsx
//
// Menu lateral fixo do Admin/Funcionário — visível em todas as telas
// internas (Dashboard, Clientes, Funcionários, Licitações, Disputas,
// Relatórios, Calendário, Configurações). Os itens exibidos dependem do
// perfil: Administrador vê tudo; Funcionário só vê os módulos liberados
// nas permissões dele (mesma lógica já usada em FuncionarioDashboard).
//
// Ícones são SVGs simples desenhados à mão (sem nenhuma biblioteca nova) —
// evita precisar rodar npm install para esta mudança.

import { useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { usePermissoes } from '@/hooks/usePermissoes'
import { funcionarioService } from '@/services/funcionarioService'
import { ROLE_LABEL } from '@/types/auth'

interface ItemMenu {
  label: string
  to: string
  icon: ReactElement
}

function IconPessoa() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.5 3.1-6 7-6s7 2.5 7 6" />
    </svg>
  )
}

function IconPessoas() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <circle cx="9" cy="8" r="3" />
      <path d="M2.5 20c0-3 2.9-5.5 6.5-5.5s6.5 2.5 6.5 5.5" />
      <circle cx="17" cy="8.5" r="2.3" />
      <path d="M15.8 14.8c2.6.5 4.7 2.4 4.7 5.2" />
    </svg>
  )
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

function IconMartelo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <path d="M14 4l6 6" />
      <path d="M9.5 8.5l6 6" />
      <path d="M3 21l6-6" />
      <path d="M11.5 6.5l-7 7 2 2 7-7z" />
      <path d="M4 21h6" />
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

function IconCalendario() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17" />
      <path d="M8 3v4M16 3v4" />
    </svg>
  )
}

function IconEngrenagem() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.2M12 18.8V21M4.6 6.6l1.6 1.6M17.8 15.8l1.6 1.6M3 12h2.2M18.8 12H21M4.6 17.4l1.6-1.6M17.8 8.2l1.6-1.6" />
    </svg>
  )
}

export function AdminSidebar() {
  const { user } = useAuth()
  const location = useLocation()
  const { podeAcessarModulo } = usePermissoes()

  const isAdmin = user?.role === 'admin'

  const itens: ItemMenu[] = [
    ...(isAdmin ? [{ label: 'Cadastro de Clientes', to: '/admin/clientes', icon: <IconPessoa /> }] : []),
    ...(isAdmin ? [{ label: 'Cadastro de Funcionários', to: '/admin/funcionarios', icon: <IconPessoas /> }] : []),
    ...(isAdmin || podeAcessarModulo('licitacoes')
      ? [{ label: 'Licitações', to: '/admin/licitacoes', icon: <IconDocumento /> }]
      : []),
    ...(isAdmin || podeAcessarModulo('disputas')
      ? [{ label: 'Disputas', to: '/admin/disputas', icon: <IconMartelo /> }]
      : []),
    ...(isAdmin || podeAcessarModulo('relatorios')
      ? [{ label: 'Relatórios', to: '/admin/relatorios', icon: <IconGrafico /> }]
      : []),
    ...(isAdmin || podeAcessarModulo('licitacoes')
      ? [{ label: 'Calendário', to: '/admin/calendario', icon: <IconCalendario /> }]
      : []),
    ...(isAdmin ? [{ label: 'Configurações', to: '/admin/configuracoes', icon: <IconEngrenagem /> }] : []),
  ]

  const iniciais = (user?.name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join('')

  const [fotoUrl, setFotoUrl] = useState<string | undefined>(undefined)
  const [enviandoFoto, setEnviandoFoto] = useState(false)
  const inputFotoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user?.funcionarioId) return
    let ativo = true
    funcionarioService.getById(user.funcionarioId).then((funcionario) => {
      if (ativo && funcionario) setFotoUrl(funcionario.fotoUrl)
    })
    return () => {
      ativo = false
    }
  }, [user?.funcionarioId])

  async function handleSelecionarFoto(event: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0]
    if (!arquivo || !user) return
    setEnviandoFoto(true)
    try {
      const url = await funcionarioService.uploadFoto(user.id, arquivo)
      setFotoUrl(url)
    } finally {
      setEnviandoFoto(false)
      event.target.value = ''
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
        {itens.map((item) => {
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
    </aside>
  )
}
