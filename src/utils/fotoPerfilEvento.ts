// src/utils/fotoPerfilEvento.ts
//
// Aviso interno de "foto de perfil trocada": o menu lateral envia a foto nova e
// a barra superior (AvatarUsuario) atualiza o avatar na hora, sem recarregar
// a página. Nenhum dado novo: só um evento do navegador com a URL da foto.

export const EVENTO_FOTO_PERFIL = 'salutti:foto-perfil'

export function avisarFotoPerfilAtualizada(url: string): void {
  window.dispatchEvent(new CustomEvent<string>(EVENTO_FOTO_PERFIL, { detail: url }))
}
