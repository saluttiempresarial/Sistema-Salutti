// src/types/indicadores.ts
//
// Tipos do painel de Indicadores (Relatórios e Dashboards — Especificação de
// 07/10/2026, seção 8: primeira entrega, 8 indicadores do Administrador).
//
// Os números são calculados no próprio sistema (ver utils/indicadoresCalculos.ts)
// a partir de dados base carregados uma única vez, para ficarem idênticos aos
// da tela de Disputa (mesmo mínimo c/ frete).

import type { Licitacao, EsferaLicitacao } from './licitacao';
import type { ChaveMotivoIndicador, GrupoMotivo } from './motivoNaoParticipacao';
import type { Disputa, ResultadoItemDisputa, MotivoPerdaHabilitacao, MotivoPerdaEvitavel, MotivoPerda } from './disputa';
import type { FamiliaProduto } from '../services/familiaProdutoService';

/** Valor do filtro de esfera para licitações sem esfera informada. */
export const FILTRO_SEM_ESFERA = 'sem-esfera';

/** Valor do filtro de família para itens que ainda não têm família. */
export const FILTRO_SEM_FAMILIA = 'sem-familia';

export interface FiltrosIndicadores {
  dataDe?: string; // YYYY-MM-DD, pela data da sessão
  dataAte?: string; // YYYY-MM-DD
  clienteId?: string;
  modalidade?: string;
  familiaId?: string; // id da família, ou FILTRO_SEM_FAMILIA
  /** Nome do órgão já normalizado (sem acento, maiúsculas nem espaços extras). */
  orgao?: string;
  /** Marca da proposta do cliente, já normalizada: só licitações com ao menos
   *  um item dessa marca; os resultados passam a considerar só esses itens. */
  marca?: string;
  /** UF do órgão (sigla em maiúsculas, ex.: "SP"). */
  uf?: string;
  /** Esfera do órgão, ou FILTRO_SEM_ESFERA para as sem esfera informada. */
  esfera?: EsferaLicitacao | typeof FILTRO_SEM_ESFERA;
  /** Analista (só o Administrador): licitações dos clientes da carteira dele. */
  analistaId?: string;
  /** Resultado da licitação (ver ResultadoLicitacaoFiltro). */
  resultado?: ResultadoLicitacaoFiltro;
  /** Fase no pipeline — filtro "Status", só para Administrador e Analista. */
  fase?: FasePipeline;
  /** Falso/ausente: só entram resultados DEFINITIVOS (disputa com "Homologado
   *  em" preenchido). Verdadeiro: entram também os provisórios. */
  incluirProvisorios?: boolean;
}

/** Resultado de uma licitação para o filtro "Resultado". "Não participou" =
 *  o cliente recusou ou a sessão passou sem ele decidir. */
export type ResultadoLicitacaoFiltro = 'ganho' | 'perdido' | 'em_andamento' | 'nao_participou';

export const ROTULO_RESULTADO_LICITACAO: Record<ResultadoLicitacaoFiltro, string> = {
  ganho: 'Ganho',
  perdido: 'Perdido',
  em_andamento: 'Em andamento',
  nao_participou: 'Não participou',
};

/** Opção de lista suspensa dos filtros (valor normalizado + nome para exibir). */
export interface OpcaoFiltro {
  value: string;
  label: string;
}

export interface ClienteResumo {
  id: string;
  nome: string;
  /** Segmento do cadastro do cliente (só no painel interno). */
  segmento?: string;
  /** Porte da empresa (só no painel interno); usado para reconhecer o bloqueio ME/EPP. */
  porte?: 'me_epp' | 'demais';
}

/** Tudo o que os cálculos precisam, carregado de uma vez. */
/** Reabertura da decisão do cliente pelo Administrador (histórico da licitação). */
export interface ReaberturaDecisao {
  licitacaoId: string;
  /** ISO do momento em que o Administrador reabriu. */
  em: string;
}

/** Analista da Salutti e os clientes da sua carteira (aba Permissões do
 *  Funcionário). Só o Administrador recebe esta lista. */
export interface AnalistaCarteira {
  id: string;
  nome: string;
  clienteIds: string[];
}

/** Uma linha do quadro de performance por analista. */
export interface PerformanceAnalista {
  id: string; // id do analista ou 'sem_analista'
  nome: string;
  clientes: number;
  /** Licitações da carteira dentro dos filtros escolhidos. */
  licitacoes: number;
  enviadas: number;
  participacoes: number;
  ganhos: number;
  perdidos: number;
  /** Ganhos ÷ (ganhos + perdidos), por item/grupo; null sem resultados. */
  taxaVitoria: number | null;
  valorAdjudicado: number;
  perdasEvitaveis: number;
  valorPerdasEvitaveis: number;
}

export interface DadosBaseIndicadores {
  /** Analistas e carteiras (só o Administrador); ausente = sem filtro por analista. */
  analistas?: AnalistaCarteira[];
  /** Faixas de inatividade de Configurações; ausente = padrão (7/14/21). */
  faixasInatividade?: { faixa1Dias: number; faixa2Dias: number; faixa3Dias: number };
  /** Reaberturas de decisão (só o Administrador as enxerga); ausente = não carregadas. */
  reaberturas?: ReaberturaDecisao[];
  licitacoes: Licitacao[]; // com grupos e itens
  disputas: Disputa[]; // com as linhas de resultado
  familias: FamiliaProduto[]; // inclusive inativas (para exibir nomes antigos)
  clientes: ClienteResumo[];
}

// ---------------------------------------------------------------------------
// Indicador 1 — Funil
// ---------------------------------------------------------------------------
export interface EtapaFunil {
  chave: 'analisadas' | 'participou' | 'ganhou';
  rotulo: string;
  quantidade: number;
}

// ---------------------------------------------------------------------------
// Indicador 2 — Taxa de vitória (quantidade e valor)
// ---------------------------------------------------------------------------
export interface TaxaVitoria {
  ganhos: number; // itens/grupos ganhos
  perdidos: number; // itens/grupos perdidos
  valorAdjudicado: number; // valor ofertado dos ganhos
  valorDisputado: number; // valor ofertado dos ganhos + perdidos
  percentualQuantidade: number | null; // null = nada disputado
  percentualValor: number | null;
  /** Leitura "1 a cada X participações": (ganhos + perdidos) ÷ ganhos.
   *  null = nenhum ganho. Ex.: taxa de 28% = 1 a cada 3,6. */
  umACada: number | null;
}

/** Taxa de vitória de um mês (mês da sessão), para a evolução mês a mês. */
export interface TaxaVitoriaMes {
  mes: string; // yyyy-mm
  rotulo: string;
  ganhos: number;
  perdidos: number;
  percentualQuantidade: number | null;
  percentualValor: number | null;
}

export interface TaxaVitoriaComparada {
  atual: TaxaVitoria;
  /** Mesmo cálculo no período anterior de igual duração; null quando o
   *  filtro de período não está completo (De e Até). */
  anterior: TaxaVitoria | null;
}

// ---------------------------------------------------------------------------
// Indicador 3 — Volume por período
// ---------------------------------------------------------------------------
export interface VolumeMes {
  mes: string; // YYYY-MM
  rotulo: string; // ex.: "out/2026"
  licitacoes: number;
  valor: number; // valor de referência
}

// ---------------------------------------------------------------------------
// Indicadores 4 e 5 — Famílias
// ---------------------------------------------------------------------------
/** Chave especial da barra que reúne os GRUPOS (o resultado do grupo é do
 *  lote inteiro e não tem família). */
export const CHAVE_GRUPOS = 'grupos';
export const CHAVE_SEM_FAMILIA = FILTRO_SEM_FAMILIA;

export interface BarraFamilia {
  chave: string; // id da família, CHAVE_SEM_FAMILIA ou CHAVE_GRUPOS
  nome: string;
  cotadas: number; // itens (ou grupos) com preço mínimo informado pelo cliente
  ganhas: number; // itens (ou grupos) ganhos
}

export interface GanhoSobreMinimoFamilia {
  chave: string;
  nome: string;
  /** (ofertado − mínimo c/ frete) ÷ mínimo, só nos ganhos. null = sem base. */
  percentual: number | null;
  quantidade: number; // itens (ou grupos) ganhos que entraram no cálculo
}

export interface GanhoSobreMinimoMarca {
  chave: string;
  nome: string;
  percentual: number | null;
  /** Ganho em reais: valor fechado − mínimo c/ frete, somado nos itens ganhos. */
  valorGanho: number;
  quantidade: number;
}

/** Faixas do ganho sobre o mínimo, por item/grupo ganho:
 *  até 3% = "no limite" (rever o preço mínimo); de 3% a 10% = saudável;
 *  acima de 10% = forte. Ganho abaixo do mínimo cai em "no limite". */
export interface FaixasGanhoSobreMinimo {
  noLimite: number;
  saudavel: number;
  forte: number;
}

export interface GanhoSobreMinimo {
  /** Percentual ponderado pelo valor. */
  geral: number | null;
  /** Ganho em reais: valor fechado − mínimo c/ frete, somado nos ganhos com mínimo. */
  valorGanho: number;
  /** Total fechado nos itens/grupos ganhos com mínimo informado. */
  valorFechado: number;
  faixas: FaixasGanhoSobreMinimo;
  /** Itens/grupos ganhos SEM preço mínimo informado (ficam fora do cálculo). */
  semMinimo: number;
  porFamilia: GanhoSobreMinimoFamilia[];
  /** Só marcas com preço próprio (itens soltos); cestas e kits não entram. */
  porMarca: GanhoSobreMinimoMarca[];
}

// ---------------------------------------------------------------------------
// Indicador 6 — Perdas evitáveis
// ---------------------------------------------------------------------------
export interface PerdaEvitavel {
  licitacaoId: string;
  clienteId: string;
  numeroPregao: string;
  cliente: string;
  rotulo: string; // "3 — Café..." ou "Grupo 2"
  ehGrupo: boolean;
  valorNosso: number | null; // nosso valor ofertado (total)
  valorVencedor: number; // valor do vencedor (total)
  valorMinimo: number; // mínimo c/ frete (total)
  nomeVencedor: string;
  /** Motivo registrado na Disputa; ausente = ainda não informado. */
  motivo?: MotivoPerdaEvitavel;
}

/** Uma linha do ranking dos motivos das perdas evitáveis. */
export interface MotivoPerdaEvitavelRanking {
  /** Chave do motivo, ou 'nao_informado'. */
  chave: MotivoPerdaEvitavel | 'nao_informado';
  nome: string;
  quantidade: number;
  valorVencedor: number;
}

export interface PerdasEvitaveis {
  linhas: PerdaEvitavel[];
  /** Soma dos valores dos vencedores nesses itens: o que teria sido adjudicado
   *  com um lance até esse valor. */
  totalVencedor: number;
  /** Ranking dos principais motivos (mais frequentes primeiro). */
  porMotivo: MotivoPerdaEvitavelRanking[];
  /** Ranking por analista (só o Administrador): quantidade e valor dos vencedores. */
  porAnalista?: { nome: string; quantidade: number; valorVencedor: number }[];
}

// ---------------------------------------------------------------------------
// Preço e competitividade — Valor adjudicado, Ticket médio, Fora de mercado,
// Distância da derrota e Desconto médio (Especificação, seções 3.3 e 3.5)
// ---------------------------------------------------------------------------
export interface ValorAdjudicadoMes {
  mes: string; // YYYY-MM
  rotulo: string; // ex.: "out/2026"
  /** Valor ofertado dos itens/grupos ganhos nas licitações do mês. */
  valor: number;
  /** Parte do valor em licitações de Sistema de Registro de Preços (SRP): é o
   *  máximo potencial da ata, não o que será empenhado. */
  valorSrp: number;
  /** Parte do valor em contratações convencionais. */
  valorConvencional: number;
  licitacoesGanhas: number;
}

/** Valor adjudicado NÃO é faturamento: em registro de preços só vira receita
 *  com empenho. A tela deve sempre dizer "valor adjudicado". */
export interface ValorAdjudicado {
  total: number;
  /** Licitações com ao menos um item/grupo ganho (mesma regra do funil). */
  licitacoesGanhas: number;
  /** total ÷ licitacoesGanhas; null = nenhuma licitação ganha. */
  ticketMedio: number | null;
  porMes: ValorAdjudicadoMes[];
}

/** Percentual geral e por família (cálculo ponderado por valor). */
export interface PercentualPorFamilia {
  chave: string; // id da família, CHAVE_SEM_FAMILIA ou CHAVE_GRUPOS
  nome: string;
  percentual: number | null;
  quantidade: number; // itens (ou grupos) que entraram no cálculo
}

export interface IndicadorPercentual {
  geral: number | null;
  /** Quantidade de itens/grupos que entraram no cálculo geral. */
  quantidade: number;
  porFamilia: PercentualPorFamilia[];
}

export interface ItemForaDeMercado {
  licitacaoId: string;
  numeroPregao: string;
  cliente: string;
  rotulo: string; // "3 — Café..." ou "Grupo 2"
  ehGrupo: boolean;
  valorNosso: number | null; // nosso valor ofertado (total)
  valorVencedor: number; // valor do vencedor (total)
  valorMinimo: number; // mínimo c/ frete (total)
  /** (mínimo − vencedor) ÷ mínimo, em %: quanto o vencedor ficou abaixo. */
  percentualAbaixo: number;
  /** Vencedor 30% ou mais abaixo do mínimo: preço possivelmente inexequível
   *  (referência interna, não é critério legal). */
  possivelmenteInexequivel: boolean;
}

/** Composição das perdas definitivas. */
export interface ComposicaoPerdas {
  total: number;
  foraDeMercado: number; // vencedor abaixo do nosso mínimo
  perdaEvitavel: number; // vencedor igual ou acima do nosso mínimo
  perdidaHabilitacao: number; // perdida na aceitação/habilitação
  semPrecoVencedor: number; // sem valor do vencedor ou sem mínimo: não dá para classificar
}

export interface ForaDeMercadoGrupo {
  chave: string;
  nome: string;
  quantidade: number; // recorrência: itens/grupos fora de mercado
  /** (mínimo − vencedor) ÷ mínimo, ponderado por valor. */
  distanciaMedia: number | null;
}

/** Perdidos em que o vencedor ficou ABAIXO do mínimo c/ frete do cliente: o
 *  preço dele não compete naquele produto. Não traz o nome do vencedor. */
export interface ForaDeMercado {
  quantidade: number;
  /** Perdidos com valor do vencedor e mínimo informados (base do percentual). */
  baseComVencedor: number;
  /** quantidade ÷ baseComVencedor, em %; null = sem base. */
  percentual: number | null;
  /** Distância média abaixo do mínimo, ponderada por valor; null = sem itens. */
  distanciaMedia: number | null;
  linhas: ItemForaDeMercado[];
  /** Quantos estão 30% ou mais abaixo do mínimo. */
  possivelmenteInexequiveis: number;
  composicao: ComposicaoPerdas;
  /** Famílias mais recorrentes em fora de mercado. */
  porFamilia: ForaDeMercadoGrupo[];
  /** Marcas (itens com marca) em fora de mercado. */
  porMarca: ForaDeMercadoGrupo[];
}

// ---------------------------------------------------------------------------
// Indicadores 7 e 8 — Órgãos e concorrentes
// ---------------------------------------------------------------------------
export interface BarraOrgao {
  orgao: string;
  participacoes: number; // licitações em que o cliente confirmou participação
  vitorias: number; // licitações com ao menos um item/grupo ganho
  /** CNPJ (14 dígitos) e UASG do órgão, quando informados no cadastro da licitação. */
  cnpj?: string;
  uasg?: string;
  /** Recorrência: licitações do mesmo órgão no período (com ou sem participação). */
  licitacoes: number;
  /** vitorias ÷ participacoes, em %; null = sem participação. */
  taxaVitoria: number | null;
  /** Valor adjudicado (itens e grupos ganhos) nas licitações do órgão. */
  valorAdjudicado: number;
}

export interface Concorrente {
  nome: string;
  /** CNPJ (14 dígitos), quando lançado junto com o nome; usado para unir grafias diferentes. */
  cnpj?: string;
  vitorias: number; // itens/grupos que ele ganhou de nós
  /** Licitações distintas em que ele ganhou de nós. */
  licitacoes: number;
  valorTotal: number; // soma dos valores dele nesses itens/grupos
  /** Em média, quanto ele fechou abaixo do nosso preço (ponderado por valor);
   *  null = sem nosso preço informado nessas perdas. */
  distanciaMedia: number | null;
  /** Famílias em que ele vence, da que mais perdemos para a que menos. */
  familias: ConcorrenteNaFamilia[];
}

// ---------------------------------------------------------------------------
// Produtos e marcas (taxa por família, marcas, produtos nunca ganhos e
// concorrentes por família)
// ---------------------------------------------------------------------------
/** Chave da barra "Sem marca" (itens cotados sem marca informada). */
export const CHAVE_SEM_MARCA = 'sem-marca';

export interface TaxaFamilia {
  chave: string; // id da família, CHAVE_SEM_FAMILIA ou CHAVE_GRUPOS
  nome: string;
  ganhos: number;
  disputados: number; // ganhos + perdidos
  percentual: number | null; // ganhos ÷ disputados (quantidade)
  /** Valor ganho ÷ valor disputado, em %. */
  percentualValor: number | null;
  /** Menos de 5 disputados: mostrar o número absoluto, sem percentual em destaque. */
  amostraPequena: boolean;
  /** Ganho sobre o mínimo da família (%, ponderado); null = sem ganho com mínimo. */
  ganhoSobreMinimo: number | null;
  /** Leitura cruzando taxa × ganho sobre o mínimo; null = amostra pequena ou sem base. */
  leitura: 'forte' | 'no_limite' | 'preco_alto' | 'dificil' | null;
}

/** Taxa de vitória por quantidade, por família: só itens e grupos ganhos ou
 *  perdidos (a mesma base da taxa de vitória geral). */
export interface TaxaVitoriaFamilia {
  geral: number | null;
  ganhos: number;
  disputados: number;
  porFamilia: TaxaFamilia[]; // até 10, das mais disputadas para as menos
}

export interface BarraMarca {
  chave: string; // marca normalizada ou CHAVE_SEM_MARCA
  nome: string; // como foi digitada pela primeira vez
  cotadas: number; // itens soltos com preço mínimo informado pelo cliente
  ganhas: number; // itens soltos ganhos
}

export interface ProdutoNuncaGanho {
  chave: string;
  nome: string;
  perdas: number; // vezes em que foi disputado e perdido
}

/** Produtos disputados (ganho ou perdido) que nunca ganharam: base para a
 *  revisão de portfólio do cliente. */
export interface ProdutosNuncaGanhos {
  totalProdutos: number; // produtos distintos já disputados
  quantidade: number; // quantos deles nunca ganharam
  linhas: ProdutoNuncaGanho[]; // até 10, dos mais perdidos
}

export interface ConcorrenteNaFamilia {
  nome: string;
  vitorias: number;
}

export interface ConcorrentesFamilia {
  chave: string; // id da família, CHAVE_SEM_FAMILIA ou CHAVE_GRUPOS
  nome: string;
  perdas: number; // itens/grupos perdidos com o vencedor identificado
  concorrentes: ConcorrenteNaFamilia[]; // até 3, os que mais ganharam de nós
}

// ---------------------------------------------------------------------------
// Pipeline — licitações por fase (gestão da carteira, uso interno)
// ---------------------------------------------------------------------------
/** Fases calculadas a partir da decisão do cliente, da proposta e do
 *  resultado da disputa (nenhum campo novo no banco). */
export type FasePipeline =
  | 'aguardando_cliente' // cliente ainda não decidiu e a sessão não passou
  | 'sem_decisao' // a sessão já passou e o cliente não decidiu
  | 'proposta' // cliente confirmou participação, proposta ainda não enviada
  | 'em_disputa' // proposta enviada, sem resultado final da disputa
  | 'finalizada' // ganha ou perdida
  | 'recusada'; // cliente recusou participar

export interface EtapaPipeline {
  chave: FasePipeline;
  rotulo: string;
  quantidade: number;
  valorReferencia: number; // soma do valor de referência das licitações da fase
  /** Só na fase "finalizada": quantas foram ganhas e quantas perdidas. */
  ganhas?: number;
  perdidas?: number;
}

export interface Pipeline {
  etapas: EtapaPipeline[];
  total: number;
  /** Sessão já ocorreu e o resultado ainda não foi lançado (fase em_disputa
   *  com a sessão no passado) — pendência de trabalho para o analista. */
  resultadoALancar: number;
}

// ---------------------------------------------------------------------------
// Prazos dos próximos 7 dias (gestão da operação, uso interno)
// ---------------------------------------------------------------------------
export type UrgenciaPrazoIndicador = 'vencido' | 'atencao' | 'ok';

export interface PrazoProximo {
  licitacaoId: string;
  clienteNome: string;
  numeroPregao: string;
  orgao: string;
  dataSessao: string; // ISO
  prazoInterno: string; // ISO — prazo interno da Salutti (regra de Configurações)
  urgencia: UrgenciaPrazoIndicador;
  decisaoCliente: 'pendente' | 'participar' | 'recusar';
}

export interface PrazosProximos {
  /** Janela olhada, em dias (7). */
  janelaDias: number;
  /** Licitações em aberto com sessão futura cujo prazo interno já passou ou
   *  vence na janela, da mais urgente para a menos urgente. */
  linhas: PrazoProximo[];
  vencidos: number;
  vencendoEm24h: number;
  /** Quantas dessas ainda estão sem decisão do cliente. */
  semDecisaoDoCliente: number;
}

// ---------------------------------------------------------------------------
// Gestão da carteira e da operação (lote 1 — Especificação, seções 3.1 a 3.3 e 3.6)
// ---------------------------------------------------------------------------
export interface AproveitamentoCliente {
  chave: string;
  nome: string;
  analisadas: number;
  participou: number;
}

/** Analisadas × participadas: de todas as licitações apresentadas, em quantas
 *  o cliente decidiu participar. */
export interface Aproveitamento {
  analisadas: number;
  participou: number;
  recusou: number;
  semDecisao: number;
  /** participou ÷ analisadas, em %; null = sem licitações. */
  percentual: number | null;
  /** Até 10 clientes, os que mais tiveram licitações. */
  porCliente: AproveitamentoCliente[];
}

export interface TempoRespostaCliente {
  chave: string;
  nome: string;
  mediaDias: number;
  medianaDias: number;
  quantidade: number;
}

/** Medida de tempo em dias úteis: mediana como número principal, média ao lado. */
export interface MedidaTempo {
  quantidade: number;
  medianaDias: number | null;
  mediaDias: number | null;
}

export interface TemposEnvio {
  /** Liberação ao cliente → sessão. */
  antecedencia: MedidaTempo;
  /** Liberação → prazo do cliente (sessão − 3 dias úteis). */
  janelaCliente: MedidaTempo;
  /** Licitações com janela menor que 2 dias úteis (inclui as já sem janela). */
  janelaCurta: number;
  /** Quantas vezes o Administrador reabriu a decisão depois do prazo do cliente. */
  reaberturasForaDoPrazo: number | null;
}

/** Tempo entre a LIBERAÇÃO da licitação ao cliente e a decisão dele (participar
 *  ou recusar). Licitações ainda não liberadas não entram. */
export interface TempoResposta {
  quantidade: number; // licitações com decisão e data da decisão
  /** Tudo em DIAS ÚTEIS. */
  mediaDias: number | null;
  medianaDias: number | null;
  aguardando: number; // ainda sem decisão
  /** Todos os clientes, dos mais lentos para os mais rápidos (pela mediana). */
  porCliente: TempoRespostaCliente[];
  /** Por analista (quem liberou). Só o Administrador vê. */
  porAnalista: TempoRespostaCliente[];
  envio: TemposEnvio;
}

/** Situação de inatividade (item 15 do documento). */
export type SituacaoInatividade = 'ok' | 'sem_envio' | 'sem_resposta' | 'sem_participacao';

export const SITUACAO_INATIVIDADE_LABEL: Record<SituacaoInatividade, { nome: string; significa: string; acao: string }> = {
  ok: { nome: 'Ativo', significa: 'Dentro das faixas', acao: '' },
  sem_envio: { nome: 'Sem envio', significa: 'A Salutti não enviou licitações', acao: 'Rever prospecção e triagem' },
  sem_resposta: { nome: 'Sem resposta', significa: 'Enviamos, o cliente não decide', acao: 'Contato comercial' },
  sem_participacao: {
    nome: 'Sem participação',
    significa: 'O cliente responde, mas sempre recusa',
    acao: 'Rever o perfil de oportunidades',
  },
};

export interface ClienteSemAtividade {
  clienteId: string;
  nome: string;
  situacao: SituacaoInatividade;
  /** 0 = dentro das faixas; 1, 2 e 3 = faixa 1, 2 ou 3 (configuráveis). */
  nivel: 0 | 1 | 2 | 3;
  /** Dias da situação (sem envio, sem resposta ou sem participação); null = nunca. */
  diasDaSituacao: number | null;
  /** Data da última atividade de cada tipo (ISO), quando houver. */
  ultimoEnvio?: string;
  ultimaResposta?: string;
  ultimaParticipacao?: string;
  /** Valor adjudicado do cliente (cruza com o risco na ordenação). */
  valorAdjudicado: number;
  /** ISO da última atividade (cadastro de licitação ou decisão); undefined = nunca teve licitação. */
  ultimaAtividade?: string;
  /** Dias desde a última atividade; null = nunca teve licitação. */
  dias: number | null;
}

export interface ClientesSemAtividade {
  /** Faixas em dias (Configurações): padrão 7, 14 e 21. */
  faixas: { faixa1Dias: number; faixa2Dias: number; faixa3Dias: number };
  /** Todos os clientes visíveis, dos mais parados para os mais ativos. O filtro
   *  de "X dias" é feito na tela. */
  linhas: ClienteSemAtividade[];
}

export interface FatiaCarteira {
  chave: string;
  nome: string;
  valor: number; // valor de referência
  percentual: number; // do total da carteira
  licitacoes: number;
}

export interface ConcentracaoCarteira {
  total: number;
  porCliente: FatiaCarteira[]; // 8 maiores + "Outros"
  porSegmento: FatiaCarteira[];
}

export interface ValorCliente {
  chave: string;
  nome: string;
  /** Valor de referência das licitações com participação confirmada e ainda sem resultado. */
  valorEmDisputa: number;
  /** Valor dos itens e grupos ganhos (não é faturamento). */
  valorAdjudicado: number;
  licitacoesGanhas: number;
  /** Licitações liberadas ao cliente. */
  enviadas: number;
  /** Licitações em que o cliente decidiu participar. */
  participacoes: number;
  /** Itens/grupos ganhos ÷ (ganhos + perdidos), em %; null = nada disputado. */
  taxaVitoria: number | null;
  /** Ganho sobre o mínimo (%, ponderado); null = sem ganho com mínimo. */
  ganhoSobreMinimo: number | null;
  /** Valor de referência de todas as licitações do cliente no período. */
  valorCarteira: number;
  /** Peso do cliente na carteira (% do valor de referência total); destaque acima de 30%. */
  pesoCarteira: number;
}

export interface DesempenhoModalidade {
  chave: string;
  nome: string;
  licitacoes: number;
  participou: number;
  ganhou: number;
  /** ganhou ÷ participou, em %; null = sem participação. */
  taxa: number | null;
}

/** Desempenho de um território (UF ou esfera): licitações, participações e vitórias. */
export interface DesempenhoTerritorio {
  chave: string;
  nome: string;
  licitacoes: number;
  participou: number;
  ganhou: number;
  /** ganhou ÷ participou, em %; null = sem participação. */
  taxa: number | null;
}

export interface MercadoUfEsfera {
  porUf: DesempenhoTerritorio[];
  porEsfera: DesempenhoTerritorio[];
}

/** Uma linha do indicador de motivos de não participação. */
export interface LinhaMotivoNaoParticipacao {
  chave: ChaveMotivoIndicador;
  nome: string;
  grupo: GrupoMotivo;
  /** 'cliente' = escolhido pelo cliente; 'sistema' = registrado ou calculado pelo sistema. */
  origem: 'cliente' | 'sistema';
  quantidade: number;
  /** % sobre o total de licitações em que o cliente não participou. */
  percentual: number;
}

export interface GrupoMotivoNaoParticipacao {
  grupo: GrupoMotivo;
  nome: string;
  quantidade: number;
  percentual: number;
}

/** Licitações em que o cliente não participou (recusou ou deixou a sessão
 *  passar sem decidir), por motivo. */
export interface TextoMotivoOutro {
  licitacaoId: string;
  numeroPregao: string;
  cliente: string;
  texto: string;
}

export interface MotivosNaoParticipacao {
  total: number;
  /** Valor de referência das oportunidades descartadas (soma das licitações). */
  valorReferenciaDescartado: number;
  /** "Sem resposta": falha de processo, separada das decisões do cliente. */
  semResposta: { quantidade: number; valorReferencia: number; percentual: number };
  /** Recusas decididas pelo cliente (base do "Outro" e da leitura de triagem). */
  recusasCliente: number;
  /** Textos digitados em "Outro". */
  textosOutro: TextoMotivoOutro[];
  /** "Outro" ÷ recusas do cliente, em %; acima de 15% = sinal de motivo faltante. */
  percentualOutro: number | null;
  /** "Produto não trabalhado" + "especificação não atendida" ÷ recusas, em %:
   *  valor alto indica falha na triagem da Salutti. null = sem recusas. */
  percentualTriagem: number | null;
  /** Só os motivos com ao menos 1 licitação, do mais frequente ao menos. */
  motivos: LinhaMotivoNaoParticipacao[];
  porGrupo: GrupoMotivoNaoParticipacao[];
}

// ---------------------------------------------------------------------------
// Relatório principal — total de licitações e funil (item 1 do documento)
// ---------------------------------------------------------------------------
export interface RelatorioPrincipal {
  /** Licitações cadastradas no período/filtros (inclui as ainda não liberadas). */
  cadastradas: number;
  /** Cadastradas e ainda NÃO liberadas ao cliente (em preparação pela Salutti). */
  emPreparacao: number;
  /** Analisadas pela Salutti e liberadas ao cliente para decisão. */
  enviadas: number;
  /** Enviadas em que o cliente respondeu (participar ou não participar). */
  retornadas: number;
  /** Enviadas − retornadas: oportunidades paradas com o cliente. */
  semRetorno: number;
  /** Recusa do cliente + bloqueio do sistema (ex.: ME/EPP). */
  naoParticipacao: number;
  naoParticipacaoRecusa: number;
  naoParticipacaoBloqueio: number;
  /** Enviadas em que o cliente decidiu participar. */
  participou: number;
  /** Participou, ficamos em 1º no lance e falta homologação. */
  arrematadasEmAnalise: number;
  /** Participou, outro ficou em 1º e falta homologação. */
  perdidasEmAnalise: number;
  /** Homologadas com ao menos um item/grupo ganho. */
  ganhas: number;
  /** Homologadas sem nenhum item/grupo ganho. */
  perdidas: number;
  /** Participou e ainda sem resultado lançado. */
  aguardandoResultado: number;
}

// ---------------------------------------------------------------------------
// Perdas na habilitação, vitórias por convocação e alerta de acompanhamento
// ---------------------------------------------------------------------------
export interface LinhaPerdaHabilitacao {
  licitacaoId: string;
  numeroPregao: string;
  orgao: string;
  cliente: string;
  rotulo: string;
  ehGrupo: boolean;
  /** Valor que deixou de ser adjudicado (preço fechado × quantidade). */
  valor: number | null;
  etapa: string;
  motivo: string;
  origem: string;
  definitiva: boolean;
}

export interface OrigemPerdaHabilitacaoResumo {
  origem: string;
  quantidade: number;
  valor: number;
}

export interface PerdasHabilitacao {
  quantidade: number;
  valorPerdido: number;
  porOrigem: OrigemPerdaHabilitacaoResumo[];
  linhas: LinhaPerdaHabilitacao[];
}

export interface LinhaVitoriaConvocacao {
  licitacaoId: string;
  numeroPregao: string;
  orgao: string;
  cliente: string;
  rotulo: string;
  ehGrupo: boolean;
  valor: number | null;
  definitiva: boolean;
}

export interface VitoriasConvocacao {
  quantidade: number;
  valor: number;
  linhas: LinhaVitoriaConvocacao[];
}

/** Perdidas em análise (sem homologação) com o cliente em 2º ou 3º lugar:
 *  ainda pode haver convocação se o 1º for desclassificado. */
export interface LinhaAlertaAcompanhamento {
  licitacaoId: string;
  numeroPregao: string;
  orgao: string;
  cliente: string;
  rotulo: string;
  ehGrupo: boolean;
  posicao: number;
  valorNosso: number | null;
  valorVencedor: number | null;
  nomeVencedor: string;
}

// ---------------------------------------------------------------------------
// Distância da derrota (item 5): extensão do IndicadorPercentual
// ---------------------------------------------------------------------------
/** Faixas, por perda: até 3%, de 3% a 10% e acima de 10% acima do vencedor. */
export interface FaixasDistanciaDerrota {
  ate3: number;
  de3a10: number;
  acima10: number;
}

export interface DistanciaMarca {
  chave: string;
  nome: string;
  /** (nosso ÷ vencedor − 1), ponderado pelo valor. */
  percentual: number | null;
  /** Reais acima do vencedor, somados. */
  valorAcima: number;
  quantidade: number;
}

/** Perda por até 3%: quase ganhamos. */
export interface PerdaPorPouco {
  licitacaoId: string;
  numeroPregao: string;
  orgao: string;
  cliente: string;
  rotulo: string;
  ehGrupo: boolean;
  valorNosso: number;
  valorVencedor: number;
  percentual: number;
  nomeVencedor: string;
}

export interface DistanciaDerrota extends IndicadorPercentual {
  /** Reais acima do vencedor, somados no período. */
  valorAcima: number;
  faixas: FaixasDistanciaDerrota;
  /** Só itens com marca informada (ranking por marca perdida). */
  porMarca: DistanciaMarca[];
  /** Perdas por até 3% acima do vencedor, da mais próxima para a mais distante. */
  perdasPorPouco: PerdaPorPouco[];
}

export interface IndicadoresAdmin {
  /** Quadro de performance por analista (vazio fora do Administrador). */
  performanceAnalistas: PerformanceAnalista[];
  taxaVitoriaPorMes: TaxaVitoriaMes[];
  perdasHabilitacao: PerdasHabilitacao;
  vitoriasConvocacao: VitoriasConvocacao;
  alertaAcompanhamento: LinhaAlertaAcompanhamento[];
  relatorioPrincipal: RelatorioPrincipal;
  funil: EtapaFunil[];
  taxaVitoria: TaxaVitoriaComparada;
  volumePorMes: VolumeMes[];
  familias: BarraFamilia[]; // top 10 já ordenado
  ganhoSobreMinimo: GanhoSobreMinimo;
  perdasEvitaveis: PerdasEvitaveis;
  valorAdjudicado: ValorAdjudicado;
  foraDeMercado: ForaDeMercado;
  /** (nosso valor ÷ valor do vencedor) − 1, só nas perdas por preço. */
  distanciaDerrota: DistanciaDerrota;
  /** 1 − (ofertado ÷ referência do edital), só nos ganhos. */
  descontoMedio: IndicadorPercentual;
  orgaos: BarraOrgao[]; // top 10
  concorrentes: Concorrente[]; // top 10
  /** Taxa de vitória por família (por quantidade). */
  taxaVitoriaFamilia: TaxaVitoriaFamilia;
  /** Marcas mais cotadas e mais ganhas (top 10). Itens de serviço não entram aqui. */
  marcas: BarraMarca[];
  /** Categorias de serviço mais cotadas e mais ganhas (top 10) — só itens de licitações de Serviços. */
  categoriasServico: BarraMarca[];
  /** Produtos disputados que nunca ganharam. */
  produtosNuncaGanhos: ProdutosNuncaGanhos;
  /** Contra quem perdemos em cada família (até 5 famílias). */
  concorrentesFamilia: ConcorrentesFamilia[];
  /** Licitações por fase (respeita todos os filtros). */
  pipeline: Pipeline;
  /** Prazos internos dos próximos 7 dias (respeita cliente, modalidade e
   *  família; ignora o período, porque olha sempre a partir de agora). */
  prazosProximos: PrazosProximos;
  aproveitamento: Aproveitamento;
  tempoResposta: TempoResposta;
  /** Ignora os filtros (olha sempre a atividade mais recente de cada cliente). */
  clientesSemAtividade: ClientesSemAtividade;
  concentracaoCarteira: ConcentracaoCarteira;
  valorPorCliente: ValorCliente[]; // 10 maiores por valor adjudicado
  desempenhoModalidade: DesempenhoModalidade[];
  mercadoUfEsfera: MercadoUfEsfera;
  motivosNaoParticipacao: MotivosNaoParticipacao;
  /** Quantidade de licitações consideradas após os filtros. */
  totalLicitacoes: number;
}

/** Uma linha de resultado de disputa já resolvida (item ou grupo) com todos
 *  os valores em TOTAL (unitário × quantidade, quando for item). */
export interface UnidadeResultado {
  licitacaoId: string;
  clienteId: string;
  tipo: 'item' | 'grupo';
  rotulo: string;
  familiaId?: string; // só itens
  /** Marca informada pelo cliente na proposta (só itens). */
  marca?: string;
  /** Categoria do serviço informada pelo cliente (só itens de licitação de Serviços). */
  categoriaServico?: string;
  /** Produto ofertado pelo cliente (só itens): código interno, marca e modelo
   *  ou descrição, nessa ordem de preferência. */
  produtoChave?: string;
  produtoNome?: string;
  resultado?: ResultadoItemDisputa;
  valorOfertado: number | null;
  valorMinimoComFrete: number | null;
  /** Valor de referência do edital (preço de referência × quantidade; no
   *  grupo, a soma dos itens). null = sem referência informada. */
  valorReferencia: number | null;
  valorVencedor: number | null;
  nomeVencedor?: string;
  /** Resultado definitivo = disputa com "Homologado em" preenchido. */
  definitiva: boolean;
  /** Data da sessão realizada (ou, na falta dela, a da licitação), ISO. */
  dataSessao?: string;
  procedimento: 'srp' | 'convencional';
  vitoriaPorConvocacao?: boolean;
  motivoPerdaHabilitacao?: MotivoPerdaHabilitacao;
  /** Por que a perda foi evitável (só perdas com vencedor igual ou acima do mínimo). */
  motivoPerdaEvitavel?: MotivoPerdaEvitavel;
  cnpjVencedor?: string;
  /** Marcas da composição de cestas e kits (só itens): contam como presença
   *  nas vitórias por marca, mas não têm valor individual. */
  marcasComposicao?: string[];
  /** Grupo a que a unidade pertence (grupo, ou item de grupo em detalhe). */
  grupoId?: string;
  /** Item de um grupo que já tem resultado próprio, com preço unitário lançado
   *  (modo "Grupo e item"). É só detalhe: alimenta marca, produto e ganho sobre
   *  o mínimo por marca, e fica fora de qualquer total, taxa ou valor, porque
   *  o grupo já conta como 1. */
  detalheDeGrupo?: boolean;
  /** Classificação do cliente no lance (1, 2, 3...). */
  posicao?: number;
  /** Motivo simples da perda (migração 059). */
  motivoPerda?: MotivoPerda;
}
