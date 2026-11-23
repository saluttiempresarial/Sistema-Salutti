// src/services/licitacaoDocumentoService.ts
//
// Documentos do edital de cada licitação (edital, TR, anexos, planilhas...),
// guardados no Supabase Storage (bucket privado "documentos-edital") e
// registrados na tabela `licitacao_documentos` (migração 068).
//
// Regras:
//   - cada licitação tem a sua própria lista, de tamanho livre;
//   - na criação para várias empresas, as cópias apontam para o MESMO arquivo
//     no Storage (copiarParaLicitacoes): só as linhas da tabela se repetem;
//   - quem abre o arquivo usa um link temporário (URL assinada), porque o
//     bucket é privado;
//   - remover apaga só o registro da licitação. O arquivo no Storage é mantido,
//     pois pode estar em uso por outra cópia que o usuário atual não enxerga.
//
// Quem pode enviar/remover (equipe) e quem pode ver (equipe e cliente da
// licitação liberada) é decidido pelo banco (RLS), não por este arquivo.

import { supabase } from '@/lib/supabaseClient'

const BUCKET = 'documentos-edital'
export const LIMITE_TAMANHO_DOCUMENTO_BYTES = 50 * 1024 * 1024 // 50 MB (igual ao bucket)
const SEGUNDOS_VALIDADE_LINK = 300

export interface DocumentoEdital {
  id: string
  licitacaoId: string
  nomeArquivo: string
  caminho: string
  tamanhoBytes: number | null
  tipoMime: string | null
  criadoEm: string
}

interface LinhaDocumento {
  id: string
  licitacao_id: string
  nome_arquivo: string
  caminho: string
  tamanho_bytes: number | null
  tipo_mime: string | null
  criado_em: string
}

const COLUNAS = 'id, licitacao_id, nome_arquivo, caminho, tamanho_bytes, tipo_mime, criado_em'

function paraDocumento(row: LinhaDocumento): DocumentoEdital {
  return {
    id: row.id,
    licitacaoId: row.licitacao_id,
    nomeArquivo: row.nome_arquivo,
    caminho: row.caminho,
    tamanhoBytes: row.tamanho_bytes,
    tipoMime: row.tipo_mime,
    criadoEm: row.criado_em,
  }
}

// O Storage rejeita chaves com acentos e alguns símbolos (ex.: "º", "ç").
// O nome original continua guardado, intacto, na coluna nome_arquivo.
function nomeSeguroParaCaminho(nome: string): string {
  const semAcento = nome.normalize('NFD').replace(/[̀-ͯ]/g, '')
  const seguro = semAcento.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '')
  return seguro.slice(-120) || 'arquivo'
}

export const licitacaoDocumentoService = {
  /** Lista os documentos de uma licitação, do mais antigo para o mais novo. */
  async listar(licitacaoId: string): Promise<DocumentoEdital[]> {
    const { data, error } = await supabase
      .from('licitacao_documentos')
      .select(COLUNAS)
      .eq('licitacao_id', licitacaoId)
      .order('criado_em', { ascending: true })
    if (error) throw new Error(`Não foi possível carregar os documentos do edital: ${error.message}`)
    return ((data ?? []) as LinhaDocumento[]).map(paraDocumento)
  },

  /** Quantos documentos cada licitação tem (para listas e validações). */
  async contarPorLicitacao(licitacaoIds: string[]): Promise<Record<string, number>> {
    if (licitacaoIds.length === 0) return {}
    const { data, error } = await supabase
      .from('licitacao_documentos')
      .select('licitacao_id')
      .in('licitacao_id', licitacaoIds)
    if (error) throw new Error(`Não foi possível contar os documentos do edital: ${error.message}`)
    const contagem: Record<string, number> = {}
    for (const linha of (data ?? []) as Array<{ licitacao_id: string }>) {
      contagem[linha.licitacao_id] = (contagem[linha.licitacao_id] ?? 0) + 1
    }
    return contagem
  },

  /**
   * Envia os arquivos para o Storage e registra cada um na licitação.
   * Se um arquivo falhar, os anteriores continuam salvos e o erro informa
   * qual arquivo deu problema.
   */
  async enviar(licitacaoId: string, arquivos: File[]): Promise<DocumentoEdital[]> {
    const enviados: DocumentoEdital[] = []

    for (const arquivo of arquivos) {
      if (arquivo.size === 0) {
        throw new Error(`O arquivo "${arquivo.name}" está vazio.`)
      }
      if (arquivo.size > LIMITE_TAMANHO_DOCUMENTO_BYTES) {
        throw new Error(`O arquivo "${arquivo.name}" passa do limite de 50 MB.`)
      }

      const caminho = `${licitacaoId}/${crypto.randomUUID()}-${nomeSeguroParaCaminho(arquivo.name)}`

      const { error: erroUpload } = await supabase.storage.from(BUCKET).upload(caminho, arquivo, {
        contentType: arquivo.type || 'application/octet-stream',
        upsert: false,
      })
      if (erroUpload) {
        throw new Error(`Falha ao enviar o arquivo "${arquivo.name}": ${erroUpload.message}`)
      }

      const { data, error } = await supabase
        .from('licitacao_documentos')
        .insert({
          licitacao_id: licitacaoId,
          nome_arquivo: arquivo.name,
          caminho,
          tamanho_bytes: arquivo.size,
          tipo_mime: arquivo.type || null,
        })
        .select(COLUNAS)
        .single()
      if (error) {
        // Evita arquivo "solto" no Storage quando o registro não foi gravado.
        await supabase.storage.from(BUCKET).remove([caminho])
        throw new Error(`Falha ao registrar o arquivo "${arquivo.name}": ${error.message}`)
      }

      enviados.push(paraDocumento(data as LinhaDocumento))
    }

    return enviados
  },

  /**
   * Cópias para várias empresas: registra, em cada licitação de destino, os
   * mesmos arquivos da licitação de origem (sem duplicar o arquivo no Storage).
   */
  async copiarParaLicitacoes(origemLicitacaoId: string, destinosIds: string[]): Promise<void> {
    if (destinosIds.length === 0) return
    const documentos = await this.listar(origemLicitacaoId)
    if (documentos.length === 0) return

    const linhas = destinosIds.flatMap((destinoId) =>
      documentos.map((doc) => ({
        licitacao_id: destinoId,
        nome_arquivo: doc.nomeArquivo,
        caminho: doc.caminho,
        tamanho_bytes: doc.tamanhoBytes,
        tipo_mime: doc.tipoMime,
      }))
    )
    const { error } = await supabase.from('licitacao_documentos').insert(linhas)
    if (error) throw new Error(`Não foi possível copiar os documentos do edital: ${error.message}`)
  },

  /** Remove o documento da licitação (o arquivo no Storage é mantido; ver topo). */
  async remover(documentoId: string): Promise<void> {
    const { error } = await supabase.from('licitacao_documentos').delete().eq('id', documentoId)
    if (error) throw new Error(`Não foi possível remover o documento: ${error.message}`)
  },

  /**
   * Link temporário (5 minutos) para abrir o arquivo. Com `baixar: true`, o
   * navegador baixa o arquivo com o nome original em vez de abri-lo na aba.
   */
  async obterLink(documento: Pick<DocumentoEdital, 'caminho' | 'nomeArquivo'>, baixar = false): Promise<string> {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(documento.caminho, SEGUNDOS_VALIDADE_LINK, baixar ? { download: documento.nomeArquivo } : undefined)
    if (error || !data?.signedUrl) {
      throw new Error(`Não foi possível abrir o arquivo "${documento.nomeArquivo}": ${error?.message ?? 'link indisponível'}`)
    }
    return data.signedUrl
  },
}
