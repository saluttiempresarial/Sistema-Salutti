// src/components/DocumentosEdital.tsx
//
// Documentos do edital de uma licitação (edital, TR, anexos...). Usado em dois
// lugares:
//   - DocumentosEditalLeitura: lista só para leitura, com "Abrir" e "Baixar"
//     (área do Cliente, em LicitacaoDetalhePage). O Cliente vê os arquivos mesmo
//     antes de decidir se vai participar;
//   - abrirDocumentoEdital e formatarTamanhoArquivo: funções de apoio também
//     usadas pelo formulário do Administrador/Analista (LicitacaoFormModal).
//
// Os arquivos ficam em um bucket privado: cada clique gera um link temporário.

import { useEffect, useState } from 'react'
import { licitacaoDocumentoService, type DocumentoEdital } from '@/services/licitacaoDocumentoService'

export function formatarTamanhoArquivo(bytes: number | null | undefined): string {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

/**
 * Abre (ou baixa) o documento. A aba é aberta antes de buscar o link, para o
 * navegador não bloquear a janela como pop-up.
 */
export async function abrirDocumentoEdital(
  documento: Pick<DocumentoEdital, 'caminho' | 'nomeArquivo'>,
  baixar = false
): Promise<void> {
  const aba = baixar ? null : window.open('', '_blank')
  try {
    const url = await licitacaoDocumentoService.obterLink(documento, baixar)
    if (baixar) {
      window.location.href = url
    } else if (aba) {
      aba.location.href = url
    } else {
      window.open(url, '_blank')
    }
  } catch (erro) {
    aba?.close()
    throw erro
  }
}

export function DocumentosEditalLeitura({ licitacaoId }: { licitacaoId: string }) {
  const [documentos, setDocumentos] = useState<DocumentoEdital[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    setCarregando(true)
    setErro(null)
    licitacaoDocumentoService
      .listar(licitacaoId)
      .then((lista) => {
        if (ativo) setDocumentos(lista)
      })
      .catch((e) => {
        if (ativo) setErro(e instanceof Error ? e.message : 'Não foi possível carregar os documentos do edital.')
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })
    return () => {
      ativo = false
    }
  }, [licitacaoId])

  async function abrir(documento: DocumentoEdital, baixar: boolean) {
    try {
      await abrirDocumentoEdital(documento, baixar)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível abrir o arquivo.')
    }
  }

  return (
    <div className="col-span-2">
      <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Documentos do edital</p>
      {carregando && <p className="mt-1 font-body text-sm text-ink-soft">Carregando documentos...</p>}
      {erro && <p className="mt-1 font-body text-sm text-red-600">{erro}</p>}
      {!carregando && !erro && documentos.length === 0 && (
        <p className="mt-1 font-body text-sm text-ink-soft">Nenhum documento disponível.</p>
      )}
      {documentos.length > 0 && (
        <ul className="mt-1.5 divide-y divide-ink-soft/20 rounded-lg border border-ink-soft/30">
          {documentos.map((documento) => (
            <li key={documento.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <span className="min-w-0 break-all font-body text-sm text-ink">
                {documento.nomeArquivo}
                {documento.tamanhoBytes != null && (
                  <span className="ml-2 text-xs text-ink-soft">({formatarTamanhoArquivo(documento.tamanhoBytes)})</span>
                )}
              </span>
              <span className="flex shrink-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => void abrir(documento, false)}
                  className="font-body text-sm font-semibold text-forest hover:underline"
                >
                  Abrir
                </button>
                <button
                  type="button"
                  onClick={() => void abrir(documento, true)}
                  className="font-body text-sm font-semibold text-forest hover:underline"
                >
                  Baixar
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
