// src/services/editalIaService.ts
//
// Sobe o PDF do edital pro Supabase Storage (bucket "editais", pasta
// "rascunhos/") e chama a Edge Function `extrair-edital-ia`, que lê o PDF
// com IA e devolve os campos do cadastro de Licitação prontos pra revisão
// humana — nunca grava nada sozinha. Usado só pelo botão "Importar edital
// (PDF)" em LicitacaoFormModal.tsx.
//
// Pré-requisitos de infraestrutura (fora do código, feitos uma vez só):
//   - bucket "editais" criado no Supabase Storage;
//   - secret ANTHROPIC_API_KEY configurada (supabase secrets set);
//   - function extrair-edital-ia publicada (supabase functions deploy).

import { supabase } from '@/lib/supabaseClient'
import type { ExtracaoEditalIA } from '@/types/extracaoEditalIA'

// Mesmo problema e mesma solução de loginUsuarioService.ts: quando a Edge
// Function responde com status de erro, o cliente do Supabase descarta o
// corpo da resposta e só entrega uma mensagem genérica em error.message —
// a mensagem de verdade (campo "erro") fica em error.context, que é o
// Response cru. Duplicado aqui de propósito (arquivos pequenos e
// independentes, sem um util compartilhado ainda para isso).
async function extrairMensagemDeErro(error: unknown): Promise<string> {
  const contexto = (error as { context?: Response })?.context
  if (contexto && typeof contexto.json === 'function') {
    try {
      const corpo = await contexto.clone().json()
      if (corpo?.erro) return corpo.erro as string
    } catch {
      // corpo não era JSON — cai pro fallback abaixo
    }
  }
  return error instanceof Error ? error.message : 'Erro desconhecido ao importar o edital'
}

export const editalIaService = {
  /**
   * Sobe o PDF e pede a extração por IA. Devolve os campos prontos pra
   * pré-preencher o formulário — quem decide aplicar e salvar é sempre o
   * Admin/Analista, nunca esta função.
   */
  async extrairDoPdf(arquivo: File): Promise<{ extracao: ExtracaoEditalIA; tokensUsados: unknown }> {
    if (arquivo.type !== 'application/pdf') {
      throw new Error('Só é possível importar o edital em PDF.')
    }

    const caminho = `rascunhos/${crypto.randomUUID()}-${arquivo.name}`

    const { error: erroUpload } = await supabase.storage.from('editais').upload(caminho, arquivo, {
      contentType: 'application/pdf',
      upsert: false,
    })
    if (erroUpload) {
      throw new Error(`Falha ao enviar o PDF: ${erroUpload.message}`)
    }

    const { data, error } = await supabase.functions.invoke('extrair-edital-ia', {
      body: { bucket: 'editais', path: caminho },
    })

    if (error) throw new Error(await extrairMensagemDeErro(error))
    if (data?.erro) throw new Error(data.erro)

    return data as { extracao: ExtracaoEditalIA; tokensUsados: unknown }
  },
}
