// src/data/mockLicitacoes.ts
//
// "Banco de dados" mockado das licitações, no mesmo espírito de
// `mockUsers.ts` / `mockClientes.ts`. Consumido só por `licitacaoService.ts`.
// Estrutura alinhada à Especificação Funcional v2.1 (5 abas + decisão do cliente).

import { Licitacao } from '../types/licitacao';

export const mockLicitacoes: Licitacao[] = [
  {
    id: 'lic-001',
    dataLicitacao: '2026-08-10T14:00:00.000Z',
    portal: 'ComprasNet',
    objeto: 'Contratação de serviços de limpeza e conservação predial',
    numeroPregao: 'PE 045/2026',
    orgao: 'Prefeitura Municipal de Osasco',
    estado: 'SP',
    municipio: 'Osasco',
    distanciaMatriz: '25km',
    modalidade: 'pregao_eletronico',
    formaDisputa: 'Aberto',
    modoDisputa: 'Eletrônico',
    participacao: 'Ampla',
    capag: 'B (3,96%)',
    restricoesMeEpp: 'Não é exclusiva. A preferência para ME/EPP não será aplicada.',
    linkEdital: 'https://www.gov.br/compras/pt-br/exemplo-pe-045-2026',
    valorTotalLicitacao: 480000,

    clienteId: 'cli-004',
    status: 'em_analise',

    habilitacao: {
      exigeAtestado: 'Sim, atestado de capacidade técnica em serviços de limpeza predial de porte similar.',
      qualificacaoTecnica: 'Atestado de capacidade técnica em serviços de limpeza predial de porte similar.',
      qualificacaoEconomicoFinanceira: 'Capital social mínimo de 10% do valor estimado.',
      regularidadeFiscal: 'Certidões federal, estadual, municipal, FGTS e trabalhista em dia.',
      exigeAmostras: '',
      outrosRequisitos: '',
    },

    condicoesComerciais: {
      intervaloLances: 'R$ 500,00 entre lances',
      formaPagamento: 'credito_conta',
      recebimentoBanco: 'Banco do Brasil',
      prazoPagamentoDias: 30,
      possuiGarantias: true,
      garantiasDetalhe: 'Garantia de execução contratual de 5% do valor do contrato.',
      prazoEntregaDias: 15,
      localEntrega: 'Almoxarifado central da Prefeitura de Osasco.',
      validadePropostaDias: 60,
    },

    pontosAtencao:
      'Cliente pediu para priorizar, é a segunda vez que participa desse órgão. Verificar exigência de atestado antes de confirmar participação.',

    grupos: [{ id: 'grp-1', numero: '1', nome: 'Grupo 1 — Materiais de limpeza' }],
    itens: [
      {
        id: 'item-1',
        grupoId: 'grp-1',
        numero: '1',
        descricao: 'Álcool 70% - galão 5L',
        unidadeMedida: 'galão',
        quantidade: 200,
        precoReferencia: 45,
        exclusivoMeEpp: false,
      },
      {
        id: 'item-2',
        grupoId: 'grp-1',
        numero: '2',
        descricao: 'Detergente neutro - galão 5L',
        unidadeMedida: 'galão',
        quantidade: 150,
        precoReferencia: 32,
        exclusivoMeEpp: false,
      },
      {
        id: 'item-3',
        numero: '3',
        descricao: 'Serviço de mão de obra terceirizada (posto mensal)',
        unidadeMedida: 'posto',
        quantidade: 12,
        precoReferencia: 4200,
        exclusivoMeEpp: false,
      },
    ],

    decisaoCliente: 'participar',
    decisaoClienteEm: '2026-07-21T09:00:00.000Z',
    cobrarFrete: false,
    statusProposta: 'rascunho',

    observacoes: 'Cliente pediu para priorizar, é a segunda vez que participa desse órgão.',
    historico: [
      { id: 'h-1', data: '2026-07-20T11:00:00.000Z', usuario: 'Márcio', acao: 'Licitação cadastrada no sistema' },
      { id: 'h-2', data: '2026-07-22T09:30:00.000Z', usuario: 'Ana (analista)', acao: 'Habilitação e condições comerciais preenchidas' },
    ],
    criadoEm: '2026-07-20T11:00:00.000Z',
    atualizadoEm: '2026-07-22T09:30:00.000Z',
  },
  {
    id: 'lic-002',
    dataLicitacao: '2026-08-04T09:00:00.000Z',
    portal: 'BEC/SP',
    objeto: 'Fornecimento de equipamentos de segurança patrimonial',
    numeroPregao: 'CC 012/2026',
    orgao: 'Governo do Estado de São Paulo',
    estado: 'SP',
    municipio: 'São Paulo',
    distanciaMatriz: '15km',
    modalidade: 'concorrencia',
    formaDisputa: 'Aberto-Fechado',
    modoDisputa: 'Eletrônico',
    participacao: 'Ampla',
    capag: 'Não se aplica.',
    restricoesMeEpp: 'Não é exclusiva. A preferência para ME/EPP não será aplicada.',
    valorTotalLicitacao: 1250000,

    clienteId: 'cli-005',
    status: 'enviado',

    habilitacao: {
      exigeAtestado: 'Sim, atestado com fornecimento mínimo de 500 unidades de equipamentos similares.',
      qualificacaoTecnica: 'Atestado com fornecimento mínimo de 500 unidades de equipamentos similares.',
      qualificacaoEconomicoFinanceira: 'Índices contábeis conforme edital, capital social mínimo de R$ 100.000,00.',
      regularidadeFiscal: 'Certidões federal, estadual, municipal, FGTS e trabalhista em dia.',
      exigeAmostras: 'Sim. O licitante classificado em primeiro lugar deverá apresentar a amostra.',
      prazoEntregaAmostraDias: 5,
      outrosRequisitos: '',
    },

    condicoesComerciais: {
      intervaloLances: 'R$ 1.000,00 entre lances',
      formaPagamento: 'boleto',
      recebimentoBanco: 'Banco do Brasil',
      prazoPagamentoDias: 45,
      possuiGarantias: false,
      prazoEntregaDias: 30,
      localEntrega: 'Depósito central da Secretaria de Segurança Pública.',
      validadePropostaDias: 90,
    },

    pontosAtencao: 'Exigência de amostra em 5 dias — avaliar logística antes de confirmar.',

    grupos: [],
    itens: [
      {
        id: 'item-1',
        numero: '1',
        descricao: 'Câmera de monitoramento externa 4K',
        unidadeMedida: 'unidade',
        quantidade: 300,
        precoReferencia: 1800,
        exclusivoMeEpp: false,
      },
      {
        id: 'item-2',
        numero: '2',
        descricao: 'Central de monitoramento digital',
        unidadeMedida: 'unidade',
        quantidade: 10,
        precoReferencia: 45000,
        exclusivoMeEpp: false,
      },
    ],

    decisaoCliente: 'participar',
    decisaoClienteEm: '2026-07-10T14:00:00.000Z',
    cobrarFrete: true,
    percentualFrete: 3,
    statusProposta: 'enviada',

    observacoes: '',
    historico: [
      { id: 'h-1', data: '2026-07-10T12:00:00.000Z', usuario: 'Márcio', acao: 'Licitação cadastrada no sistema' },
      { id: 'h-2', data: '2026-07-19T10:00:00.000Z', usuario: 'Bruno (analista)', acao: 'Proposta enviada ao cliente' },
    ],
    criadoEm: '2026-07-10T12:00:00.000Z',
    atualizadoEm: '2026-07-25T13:00:00.000Z',
  },
  {
    id: 'lic-003',
    dataLicitacao: '2026-07-05T10:00:00.000Z',
    portal: 'Licitações-e',
    objeto: 'Aquisição de gêneros alimentícios para merenda escolar',
    numeroPregao: 'PE 009/2026',
    orgao: 'Prefeitura Municipal de Barueri',
    estado: 'SP',
    municipio: 'Barueri',
    distanciaMatriz: '30km',
    modalidade: 'pregao_eletronico',
    formaDisputa: 'Aberto',
    modoDisputa: 'Eletrônico',
    participacao: 'Exclusiva ME/EPP',
    capag: 'B (3,96%)',
    restricoesMeEpp: 'Exclusiva para ME/EPP, conforme art. 48 da LC 123/2006.',
    valorTotalLicitacao: 320000,

    clienteId: 'cli-003',
    status: 'perdido',

    habilitacao: {
      exigeAtestado: '',
      qualificacaoTecnica: '',
      qualificacaoEconomicoFinanceira: '',
      regularidadeFiscal: 'Certidões federal, estadual e municipal em dia.',
      exigeAmostras: '',
      outrosRequisitos: '',
    },

    condicoesComerciais: {
      intervaloLances: 'R$ 200,00 entre lances',
      formaPagamento: 'pix',
      recebimentoBanco: 'Banco do Brasil',
      prazoPagamentoDias: 15,
      possuiGarantias: false,
      prazoEntregaDias: 7,
      localEntrega: 'Almoxarifado da Secretaria de Educação.',
      validadePropostaDias: 60,
    },

    pontosAtencao: 'Concorrente ofertou valor abaixo do estimado. Avaliar margem para próximas disputas desse órgão.',

    grupos: [],
    itens: [
      {
        id: 'item-1',
        numero: '1',
        descricao: 'Arroz tipo 1 - saco 5kg',
        unidadeMedida: 'saco',
        quantidade: 2000,
        precoReferencia: 22,
        exclusivoMeEpp: true,
      },
    ],

    decisaoCliente: 'participar',
    decisaoClienteEm: '2026-06-15T10:00:00.000Z',
    cobrarFrete: false,
    statusProposta: 'enviada',

    observacoes: 'Concorrente ofertou valor abaixo do estimado. Avaliar margem para próximas disputas desse órgão.',
    historico: [
      { id: 'h-1', data: '2026-06-15T09:00:00.000Z', usuario: 'Márcio', acao: 'Licitação cadastrada no sistema' },
      { id: 'h-2', data: '2026-07-05T11:00:00.000Z', usuario: 'Ana (analista)', acao: 'Resultado da disputa: perdido' },
    ],
    criadoEm: '2026-06-15T09:00:00.000Z',
    atualizadoEm: '2026-07-05T11:00:00.000Z',
  },
  {
    id: 'lic-004',
    dataLicitacao: '2026-08-06T13:30:00.000Z',
    portal: 'Portal de Compras do Município',
    objeto: 'Reforma e manutenção predial',
    numeroPregao: 'TP 003/2026',
    orgao: 'Câmara Municipal de Cotia',
    estado: 'SP',
    municipio: 'Cotia',
    distanciaMatriz: '40km',
    modalidade: 'tomada_de_precos',
    formaDisputa: 'Fechado',
    modoDisputa: 'Presencial',
    participacao: 'Ampla',
    capag: '',
    restricoesMeEpp: '',
    valorTotalLicitacao: undefined, // orçamento sigiloso

    clienteId: 'cli-001',
    status: 'pendente',

    habilitacao: {
      exigeAtestado: '',
      qualificacaoTecnica: '',
      qualificacaoEconomicoFinanceira: '',
      regularidadeFiscal: '',
      exigeAmostras: '',
      outrosRequisitos: '',
    },

    condicoesComerciais: {
      intervaloLances: '',
      formaPagamento: 'outros',
      recebimentoBanco: '',
      possuiGarantias: false,
      localEntrega: '',
    },

    pontosAtencao: '',

    grupos: [],
    itens: [],

    decisaoCliente: 'pendente',
    cobrarFrete: false,
    statusProposta: 'rascunho',

    observacoes: '',
    historico: [
      { id: 'h-1', data: '2026-07-28T08:00:00.000Z', usuario: 'Márcio', acao: 'Licitação cadastrada no sistema' },
    ],
    criadoEm: '2026-07-28T08:00:00.000Z',
    atualizadoEm: '2026-07-28T08:00:00.000Z',
  },
];
