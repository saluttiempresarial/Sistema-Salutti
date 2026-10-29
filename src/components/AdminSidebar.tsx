// src/components/AdminSidebar.tsx
//
// Menu lateral do Admin/Funcionário — visível em todas as telas internas
// (Início, Clientes, Funcionários, Licitações, Disputas, Relatórios,
// Indicadores, Calendário, Configurações). Os itens dependem do perfil:
// Administrador vê tudo; Funcionário só vê os módulos liberados nas
// permissões dele (mesma lógica já usada no painel do Funcionário).
//
// Redesenho (15/10, a pedido do Márcio): logotipo no topo, cartão do perfil
// (com a troca de foto de sempre), ícones padronizados (components/icones.tsx),
// item "Início", página atual destacada e, no celular e no tablet, o menu vira
// uma gaveta que abre pelo botão da barra superior (AdminTopBar).

import { useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { usePermissoes } from '@/hooks/usePermissoes'
import { funcionarioService } from '@/services/funcionarioService'
import { ROLE_HOME_ROUTE, ROLE_LABEL } from '@/types/auth'
import { Logo } from '@/components/Logo'
import { FotoPerfilCropModal } from './FotoPerfilCropModal'
import {
  IconeCalendario,
  IconeDocumento,
  IconeEngrenagem,
  IconeFechar,
  IconeGrafico,
  IconeInicio,
  IconeMartelo,
  IconePessoa,
  IconePessoas,
} from '@/components/icones'

interface ItemMenu {
  label: string
  to: string
  icon: ReactElement
  /** Só fica ativo quando o endereço é exatamente este (usado no Início). */
  exato?: boolean
}

interface AdminSidebarProps {
  /** Gaveta aberta (só vale no celular e no tablet; no computador o menu é fixo). */
  aberta?: boolean
  onFechar?: () => void
}

export function AdminSidebar({ aberta = false, onFechar }: AdminSidebarProps) {
  const { user } = useAuth()
  const location = useLocation()
  const { podeAcessarModulo } = usePermissoes()

  const isAdmin = user?.role === 'admin'
  const rotaInicio = user ? ROLE_HOME_ROUTE[user.role] : '/'

  const itens: ItemMenu[] = [
    { label: 'Início', to: rotaInicio, icon: <IconeInicio />, exato: true },
    ...(isAdmin ? [{ label: 'Cadastro de Clientes', to: '/admin/clientes', icon: <IconePessoa /> }] : []),
    ...(isAdmin ? [{ label: 'Cadastro de Funcionários', to: '/admin/funcionarios', icon: <IconePessoas /> }] : []),
    ...(isAdmin || podeAcessarModulo('licitacoes')
      ? [{ label: 'Licitações', to: '/admin/licitacoes', icon: <IconeDocumento /> }]
      : []),
    ...(isAdmin || podeAcessarModulo('disputas')
      ? [{ label: 'Disputas', to: '/admin/disputas', icon: <IconeMartelo /> }]
      : []),
    ...(isAdmin || podeAcessarModulo('relatorios')
      ? [{ label: 'Relatórios', to: '/admin/relatorios', icon: <IconeGrafico /> }]
      : []),
    // Os Indicadores ficam dentro de Relatórios (aba Indicadores) para todos os
    // perfis internos; não há mais item próprio no menu.
    ...(isAdmin || podeAcessarModulo('licitacoes')
      ? [{ label: 'Calendário', to: '/admin/calendario', icon: <IconeCalendario /> }]
      : []),
    ...(isAdmin ? [{ label: 'Configurações', to: '/admin/configuracoes', icon: <IconeEngrenagem /> }] : []),
  ]

  function estaAtivo(item: ItemMenu): boolean {
    if (item.exato) return location.pathname === item.to
    return location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
  }

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
  // o recorte (30/09, a pedido do Márcio: antes ia direto pro upload, sem
  // deixar a pessoa escolher a parte da foto que aparece no avatar).
  const [arquivoParaRecortar, setArquivoParaRecortar] = useState<File | null>(null)

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
      const url = await funcionarioService.uploadFoto(user.id, arquivoRecortado)
      setFotoUrl(url)
    } finally {
      setEnviandoFoto(false)
    }
  }

  return (
    <>
      {/* Fundo escurecido atrás da gaveta (celular e tablet) */}
      {aberta && (
        <div
          className="fixed inset-0 z-40 bg-charcoal/50 lg:hidden"
          onClick={onFechar}
          aria-hidden="true"
        />
      )}

      {/* `lg:transform-none` evita que a gaveta vire referência de posição
          para janelas (modais) abertas de dentro dela. */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-forest-deep transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-64 lg:max-w-none lg:shrink-0 lg:self-start lg:transform-none ${
          aberta ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between gap-2 px-4 pb-3 pt-4">
          <Link
            to={rotaInicio}
            className="block flex-1 rounded-2xl bg-paper px-4 py-3 shadow-soft"
            aria-label="Salutti Empresarial — ir para o início"
          >
            <Logo />
            <p className="mt-1 pl-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.3em] text-brass">
              Empresarial
            </p>
          </Link>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar o menu"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white/80 hover:bg-white/10 lg:hidden"
          >
            <IconeFechar className="h-6 w-6" />
          </button>
        </div>

        <div className="mx-4 mb-2 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
          <button
            type="button"
            onClick={() => inputFotoRef.current?.click()}
            disabled={enviandoFoto}
            aria-label={fotoUrl ? 'Trocar foto de perfil' : 'Adicionar foto de perfil'}
            className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-forest ring-2 ring-white/20 disabled:opacity-60"
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
          <div className="min-w-0">
            <p className="font-body text-sm font-semibold leading-snug text-white">{user?.name ?? '—'}</p>
            <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wide text-white/60">
              {user ? ROLE_LABEL[user.role] : ''}
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-3" aria-label="Menu principal">
          {itens.map((item) => {
            const ativo = estaAtivo(item)
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={ativo ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 font-body text-sm transition-colors ${
                  ativo
                    ? 'bg-forest font-semibold text-white shadow-soft ring-1 ring-white/10'
                    : 'text-white/75 hover:bg-white/10 hover:text-white'
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Frase institucional no rodapé do menu (16/10) */}
        <div className="mx-3 mb-5 mt-2 border-t border-white/10 px-3 pt-5">
          <div className="border-l-2 border-brass pl-3">
            <p className="font-body text-sm font-bold uppercase leading-snug tracking-wide text-white">
              Qualidade que gera <span className="text-brass-light">confiança.</span>
            </p>
            <p className="mt-1 font-body text-sm font-bold uppercase leading-snug tracking-wide text-white">
              Estratégia que entrega <span className="text-brass-light">resultados.</span>
            </p>
          </div>
        </div>
      </aside>

      <FotoPerfilCropModal
        arquivo={arquivoParaRecortar}
        onCancelar={() => setArquivoParaRecortar(null)}
        onConfirmar={handleConfirmarRecorte}
      />
    </>
  )
}
