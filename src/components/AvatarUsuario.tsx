// src/components/AvatarUsuario.tsx
//
// Avatar redondo da barra superior: mostra a foto de perfil de quem está
// logado (a mesma enviada pelo menu lateral) e, quando ainda não há foto,
// as iniciais do nome. Vale para o Administrador, o Funcionário e o Cliente.
// Se a foto trocar no menu lateral, o avatar acompanha (fotoPerfilEvento).

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { funcionarioService } from '@/services/funcionarioService'
import { usuarioClienteService } from '@/services/usuarioClienteService'
import { EVENTO_FOTO_PERFIL } from '@/utils/fotoPerfilEvento'

export function AvatarUsuario() {
  const { user } = useAuth()
  const [fotoUrl, setFotoUrl] = useState<string | undefined>(undefined)

  const iniciais = (user?.name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join('')

  useEffect(() => {
    let ativo = true
    setFotoUrl(undefined)
    if (user?.funcionarioId) {
      funcionarioService
        .getById(user.funcionarioId)
        .then((funcionario) => {
          if (ativo && funcionario) setFotoUrl(funcionario.fotoUrl)
        })
        .catch(() => undefined)
    } else if (user?.usuarioClienteId) {
      usuarioClienteService
        .buscarFotoPropria(user.usuarioClienteId)
        .then((url) => {
          if (ativo) setFotoUrl(url)
        })
        .catch(() => undefined)
    }
    return () => {
      ativo = false
    }
  }, [user?.funcionarioId, user?.usuarioClienteId])

  useEffect(() => {
    function aoTrocarFoto(evento: Event) {
      setFotoUrl((evento as CustomEvent<string>).detail)
    }
    window.addEventListener(EVENTO_FOTO_PERFIL, aoTrocarFoto)
    return () => window.removeEventListener(EVENTO_FOTO_PERFIL, aoTrocarFoto)
  }, [])

  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-forest-deep font-body text-sm font-semibold text-white">
      {fotoUrl ? <img src={fotoUrl} alt="" className="h-full w-full object-cover" /> : iniciais || '—'}
    </div>
  )
}
