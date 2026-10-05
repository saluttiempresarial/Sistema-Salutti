// supabase/functions/extrair-edital-ia/index.ts
//
// Edge Function que recebe o PDF de um edital (já enviado ao Supabase
// Storage) e devolve um JSON pronto para pré-preencher o formulário de
// Nova Licitação (abas: Informações Gerais, Habilitação, Declarações,
// Cond. Comerciais, Outras Exigências, Itens, Ponto de Atenção).
//
// IMPORTANTE — isto é um RASCUNHO para revisão humana. Esta função nunca
// grava nada no banco; ela só devolve o JSON para o front-end pré-encher
// o estado do formulário (ver aplicarExtracaoIA no LicitacaoFormModal.tsx).
// Quem decide salvar é sempre o Admin/Analista, pelo fluxo normal de
// handleSalvar (com a validação de obrigatórios que já existe).
//
// Variáveis de ambiente necessárias (supabase secrets set):
//   ANTHROPIC_API_KEY         — chave da API da Anthropic
//   SUPABASE_URL              — já fornecida automaticamente pelo runtime
//   SUPABASE_SERVICE_ROLE_KEY — já fornecida automaticamente pelo runtime
//
// Chamada esperada do front-end (depois do upload do PDF ao Storage):
//   POST /functions/v1/extrair-edital-ia
//   body: { bucket: "editais", path: "licitacoes/tmp/edital-xyz.pdf" }

import { createClient } from 'npm:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk@0.32';
import { z } from 'npm:zod@3';

// ---------------------------------------------------------------------------
// Listas fixas dos checklists — DUPLICADAS de src/types/licitacao.ts de
// propósito (Edge Function roda isolada, sem import do código do front-end).
// Se um item for adicionado/removido lá, precisa espelhar aqui também.
// Risco registrado: manter os dois lados sincronizados manualmente até
// existir um pacote compartilhado entre front-end e functions/.
// ---------------------------------------------------------------------------

const HABILITACAO_JURIDICA_IDS = [
  'contrato_social',
  'doc_identificacao_socios',
  'procuracao_credenciamento',
  'autorizacao_funcionamento',
  'outras_juridica',
] as const;

const HABILITACAO_FISCAL_IDS = [
  'cartao_cnpj',
  'inscricao_estadual_municipal',
  'cnd_federal',
  'cnd_estadual',
  'cnd_municipal',
  'fgts_crf',
  'cndt',
  'outras_fiscal',
] as const;

const HABILITACAO_ECONOMICO_FINANCEIRA_IDS = [
  'balanco_patrimonial',
  'indices_economico_financeiros',
  'declaracao_contador',
  'certidao_falencia',
  'capital_social_minimo',
  'patrimonio_liquido_minimo',
  'outras_economico_financeira',
] as const;

const HABILITACAO_TECNICA_IDS = [
  'atestado_capacidade_tecnica',
  'responsavel_tecnico',
  'registro_conselho_profissional',
  'vistoria_visita_tecnica',
  'indicacao_equipe_instalacoes',
  'outras_tecnica',
] as const;

const DECLARACOES_IDS = [
  'cumprimento_requisitos_habilitacao',
  'reserva_cargos_pcd',
  'nao_emprego_menor',
  'enquadramento_me_epp',
  'proposta_compativel_custos_trabalhistas',
  'inexistencia_fato_impeditivo',
  'elaboracao_independente_proposta',
  'outras_declaracoes',
] as const;

const OUTRAS_EXIGENCIAS_IDS = [
  'amostra',
  'catalogo_folder_tecnico',
  'ficha_tecnica_produto',
  'fispq_fds',
  'laudo_tecnico_ensaio',
  'certificacao',
  'registro_anvisa',
  'registros_especificos',
  'licenca_autorizacao_especifica',
  'indicacao_marca_modelo',
  'garantia_assistencia_tecnica',
  'instalacao',
  'outras_exigencias',
] as const;

// ---------------------------------------------------------------------------
// Schema de validação (zod) — espelha ExtracaoEditalIA combinado com o
// doc de arquitetura. Qualquer campo fora disso é rejeitado; qualquer id de
// checklist fora da lista fixa é rejeitado (nunca vira item novo).
// ---------------------------------------------------------------------------

function itemChecklistSchema<T extends readonly string[]>(idsPermitidos: T) {
  return z.object({
    id: z.enum(idsPermitidos as unknown as [string, ...string[]]),
    status: z.enum(['exigido', 'nao_exigido']),
    detalhamento: z.string(),
  });
}

const extracaoSchema = z.object({
  // Aba 1 — Informações Gerais
  dataLicitacao: z.string().datetime({ offset: true }).optional(),
  portal: z.string(),
  objeto: z.string(),
  numeroPregao: z.string(),
  orgao: z.string(),
  estado: z.string().length(2),
  municipio: z.string(),
  modalidade: z.string(),
  estrutura: z.enum(['item', 'lote_grupo']),
  tipoContratacao: z.string(),
  procedimento: z.string(),
  formaDisputa: z.string(),
  modoDisputa: z.string(),
  participacao: z.enum(['exclusiva_me_epp', 'ampla_concorrencia']),
  capag: z.string().optional(),
  valorTotalLicitacao: z.number().optional(),

  // Aba 2 — Habilitação
  habilitacao: z.object({
    juridica: z.array(itemChecklistSchema(HABILITACAO_JURIDICA_IDS)),
    fiscalSocialTrabalhista: z.array(itemChecklistSchema(HABILITACAO_FISCAL_IDS)),
    economicoFinanceira: z.array(itemChecklistSchema(HABILITACAO_ECONOMICO_FINANCEIRA_IDS)),
    tecnica: z.array(itemChecklistSchema(HABILITACAO_TECNICA_IDS)),
  }),

  // Aba 3 — Declarações
  declaracoes: z.array(itemChecklistSchema(DECLARACOES_IDS)),

  // Aba 4 — Condições Comerciais
  condicoesComerciais: z.object({
    tipoIntervaloLances: z.enum(['valor', 'percentual']).optional(),
    valorIntervaloLances: z.number().optional(),
    percentualIntervaloLances: z.number().optional(),
    intervaloLancesDetalhe: z.string().optional(),
    formaPagamento: z.string(),
    prazoPagamentoDias: z.number().optional(),
    possuiGarantias: z.boolean(),
    garantiasDetalhe: z.string().optional(),
    prazoEntregaDias: z.number().optional(),
    localEntrega: z.string(),
    validadePropostaDias: z.number().optional(),
  }),

  // Aba 5 — Outras Exigências
  outrasExigencias: z.array(itemChecklistSchema(OUTRAS_EXIGENCIAS_IDS)),

  // Aba 6 — Itens
  grupos: z.array(z.object({ numero: z.string(), nome: z.string() })),
  itens: z.array(
    z.object({
      grupoNumero: z.string().optional(),
      numero: z.string(),
      descricao: z.string(),
      unidadeMedida: z.string(),
      quantidade: z.number(),
      precoReferencia: z.number(),
      exclusivoMeEpp: z.boolean(),
    })
  ),

  // Aba 7 — Ponto de Atenção
  pontosAtencao: z.string(),

  // Metadados próprios da extração (não vão pro formulário — servem para
  // o front-end decidir o que destacar visualmente e o que pedir revisão)
  camposComBaixaConfianca: z.array(z.string()).default([]),
});

export type ExtracaoEditalIA = z.infer<typeof extracaoSchema>;

// ---------------------------------------------------------------------------
// Tool schema no formato que a API da Anthropic exige (JSON Schema) — é
// isto que força o modelo a devolver exatamente esta estrutura, em vez de
// texto livre. Gerado a partir do mesmo contrato do zod acima, só que na
// sintaxe de JSON Schema (a API da Anthropic não aceita o schema do zod
// diretamente).
// ---------------------------------------------------------------------------

function checklistJsonSchema(idsPermitidos: readonly string[]) {
  return {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string', enum: [...idsPermitidos] },
        status: { type: 'string', enum: ['exigido', 'nao_exigido'] },
        detalhamento: { type: 'string' },
      },
      required: ['id', 'status', 'detalhamento'],
    },
  };
}

const ferramentaExtracao = {
  name: 'preencher_licitacao',
  description:
    'Preenche os campos do cadastro de licitação a partir do texto do edital em PDF.',
  input_schema: {
    type: 'object',
    properties: {
      dataLicitacao: { type: 'string', description: 'ISO 8601, data e horário da sessão' },
      portal: { type: 'string' },
      objeto: { type: 'string' },
      numeroPregao: { type: 'string' },
      orgao: { type: 'string' },
      estado: { type: 'string', description: 'sigla UF, 2 letras' },
      municipio: { type: 'string' },
      modalidade: { type: 'string' },
      estrutura: { type: 'string', enum: ['item', 'lote_grupo'] },
      tipoContratacao: { type: 'string' },
      procedimento: { type: 'string' },
      formaDisputa: { type: 'string' },
      modoDisputa: { type: 'string' },
      participacao: { type: 'string', enum: ['exclusiva_me_epp', 'ampla_concorrencia'] },
      capag: { type: 'string' },
      valorTotalLicitacao: { type: 'number' },

      habilitacao: {
        type: 'object',
        properties: {
          juridica: checklistJsonSchema(HABILITACAO_JURIDICA_IDS),
          fiscalSocialTrabalhista: checklistJsonSchema(HABILITACAO_FISCAL_IDS),
          economicoFinanceira: checklistJsonSchema(HABILITACAO_ECONOMICO_FINANCEIRA_IDS),
          tecnica: checklistJsonSchema(HABILITACAO_TECNICA_IDS),
        },
        required: ['juridica', 'fiscalSocialTrabalhista', 'economicoFinanceira', 'tecnica'],
      },

      declaracoes: checklistJsonSchema(DECLARACOES_IDS),

      condicoesComerciais: {
        type: 'object',
        properties: {
          tipoIntervaloLances: { type: 'string', enum: ['valor', 'percentual'] },
          valorIntervaloLances: { type: 'number' },
          percentualIntervaloLances: { type: 'number' },
          intervaloLancesDetalhe: { type: 'string' },
          formaPagamento: { type: 'string' },
          prazoPagamentoDias: { type: 'number' },
          possuiGarantias: { type: 'boolean' },
          garantiasDetalhe: { type: 'string' },
          prazoEntregaDias: { type: 'number' },
          localEntrega: { type: 'string' },
          validadePropostaDias: { type: 'number' },
        },
        required: ['formaPagamento', 'possuiGarantias', 'localEntrega'],
      },

      outrasExigencias: checklistJsonSchema(OUTRAS_EXIGENCIAS_IDS),

      grupos: {
        type: 'array',
        items: {
          type: 'object',
          properties: { numero: { type: 'string' }, nome: { type: 'string' } },
          required: ['numero', 'nome'],
        },
      },
      itens: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            grupoNumero: { type: 'string' },
            numero: { type: 'string' },
            descricao: { type: 'string' },
            unidadeMedida: { type: 'string' },
            quantidade: { type: 'number' },
            precoReferencia: { type: 'number' },
            exclusivoMeEpp: { type: 'boolean' },
          },
          required: ['numero', 'descricao', 'unidadeMedida', 'quantidade', 'precoReferencia', 'exclusivoMeEpp'],
        },
      },

      pontosAtencao: { type: 'string' },

      camposComBaixaConfianca: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Nomes dos campos (ex.: "valorTotalLicitacao", "condicoesComerciais.prazoEntregaDias") que a IA preencheu com baixa certeza — o documento era ambíguo, ilegível ou a informação não estava explícita. O front-end usa isso para destacar esses campos como "confira com atenção" para o Admin/Analista.',
      },
    },
    required: [
      'portal',
      'objeto',
      'numeroPregao',
      'orgao',
      'estado',
      'municipio',
      'modalidade',
      'estrutura',
      'tipoContratacao',
      'procedimento',
      'formaDisputa',
      'modoDisputa',
      'participacao',
      'habilitacao',
      'declaracoes',
      'condicoesComerciais',
      'outrasExigencias',
      'grupos',
      'itens',
      'pontosAtencao',
    ],
  },
};

const PROMPT_SISTEMA = `Você é um analista de licitações públicas brasileiras lendo o PDF de um edital para preencher um cadastro interno.

REGRAS OBRIGATÓRIAS:
1. Preencha SOMENTE com base no que está escrito no documento. Nunca invente valor, prazo, número ou exigência que não esteja explícito.
2. Para os checklists (habilitação, declaracoes, outrasExigencias): cada item da lista fixa recebida na ferramenta deve ser classificado como "exigido" ou "nao_exigido". NUNCA crie um item fora da lista fixa — se o edital tiver uma exigência que não se encaixa em nenhum item específico, registre-a no item cujo id termina em "outras_*" daquela mesma seção, com o texto no campo detalhamento.
3. Quando "nao_exigido", deixe detalhamento como string vazia.
4. Se uma informação não estiver explícita no edital e não puder ser inferida com segurança, OMITA o campo (quando opcional) em vez de adivinhar, e liste o nome do campo em camposComBaixaConfianca. Para campos obrigatórios do schema que não constarem claramente no edital, preencha com a melhor leitura possível e também liste em camposComBaixaConfianca.
5. "estrutura" = "lote_grupo" quando o edital organiza itens em lotes/grupos (ainda que cada lote tenha um item só); "item" quando todos os itens são individuais, sem agrupamento.
6. "participacao" = "exclusiva_me_epp" somente se TODO o objeto for exclusivo ME/EPP/COOP; se houver mistura de lotes amplos e exclusivos, ou só parte for exclusiva, use "ampla_concorrencia" e detalhe a regra de exclusividade por lote no campo pontosAtencao.
7. Cada item em "itens" deve referenciar seu grupo por "grupoNumero" (igual ao "numero" do grupo correspondente em "grupos"), quando houver agrupamento. Itens individuais (estrutura = "item") não precisam de grupoNumero.
8. "pontosAtencao" deve resumir riscos e exigências que merecem atenção humana: prazos apertados, exigências incomuns, ambiguidades do próprio edital, divergências (ex.: número do pregão divergente entre capa e nome do arquivo), e qualquer suposição que você tenha feito.
9. Responda SOMENTE pela ferramenta "preencher_licitacao" — nunca em texto livre.`;

// ---------------------------------------------------------------------------
// Handler HTTP
// ---------------------------------------------------------------------------

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const { bucket, path } = await req.json();
    if (!bucket || !path) {
      return respostaErro(400, 'Parâmetros obrigatórios: bucket, path.');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Baixa o PDF do Storage (bucket privado — acesso via service role,
    // nunca exposto ao cliente diretamente)
    const { data: arquivo, error: erroDownload } = await supabase.storage
      .from(bucket)
      .download(path);

    if (erroDownload || !arquivo) {
      return respostaErro(404, `Não foi possível baixar o arquivo: ${erroDownload?.message ?? 'não encontrado'}`);
    }

    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    const base64 = encodeBase64(bytes);

    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

    const resposta = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 8000,
      system: PROMPT_SISTEMA,
      tools: [ferramentaExtracao],
      tool_choice: { type: 'tool', name: 'preencher_licitacao' },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: base64 },
            },
            {
              type: 'text',
              text: 'Leia este edital e preencha o cadastro de licitação pela ferramenta preencher_licitacao, seguindo rigorosamente as regras do prompt do sistema.',
            },
          ],
        },
      ],
    });

    const chamadaFerramenta = resposta.content.find(
      (bloco): bloco is Anthropic.ToolUseBlock => bloco.type === 'tool_use'
    );

    if (!chamadaFerramenta) {
      return respostaErro(502, 'A IA não devolveu a extração no formato esperado (sem tool_use).');
    }

    const validacao = extracaoSchema.safeParse(chamadaFerramenta.input);

    if (!validacao.success) {
      // Não inventa um retorno parcial "mais ou menos certo" — devolve o
      // erro de validação para log, e o front-end avisa que a extração
      // falhou e pede preenchimento manual desta licitação.
      return respostaErro(502, 'JSON devolvido pela IA não bateu com o schema esperado.', {
        detalhesValidacao: validacao.error.flatten(),
        tokensUsados: resposta.usage,
      });
    }

    return new Response(
      JSON.stringify({
        extracao: validacao.data,
        tokensUsados: resposta.usage,
      }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  } catch (erro) {
    console.error('Erro na extração de edital por IA:', erro);
    return respostaErro(500, 'Erro interno ao processar o edital.');
  }
});

function respostaErro(status: number, mensagem: string, detalhes?: unknown) {
  return new Response(JSON.stringify({ erro: mensagem, ...(detalhes ? { detalhes } : {}) }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function encodeBase64(bytes: Uint8Array): string {
  let binario = '';
  const tamanhoBloco = 0x8000;
  for (let i = 0; i < bytes.length; i += tamanhoBloco) {
    binario += String.fromCharCode(...bytes.subarray(i, i + tamanhoBloco));
  }
  return btoa(binario);
}
