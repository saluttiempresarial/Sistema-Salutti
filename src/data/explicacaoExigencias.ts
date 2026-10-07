// src/data/explicacaoExigencias.ts
//
// Explicação de cada exigência dos checklists do cadastro de licitação
// (Habilitação, Declarações e Outras Exigências), exibida no balão "ⓘ" ao
// lado do nome do item (componente InfoTooltip).
//
// Os textos vêm, sem alteração, do documento "Guia de Exigências do Edital
// — SALUTTI" (06/10/2026). A chave é o mesmo `id` dos itens definidos em
// src/types/licitacao.ts (HABILITACAO_JURIDICA_ITENS etc.), então basta
// editar o texto aqui para mudar a explicação em todas as telas.
//
// Quebras de linha (\n) separam parágrafos e listas dentro da explicação —
// o balão as respeita.
//
// Se um item novo for criado em licitacao.ts, acrescente aqui a explicação
// dele; enquanto não houver, o item aparece normalmente, só sem o "ⓘ".

export const EXPLICACAO_EXIGENCIAS: Record<string, string> = {

  // ---- Habilitação jurídica ----
  // Contrato social / ato constitutivo
  contrato_social: "Documento que comprova a existência legal da empresa: contrato social, estatuto ou requerimento de empresário/MEI. Deve ser apresentado com todas as alterações ou na versão consolidada mais recente. A atividade descrita no objeto social precisa ser compatível com o objeto da licitação.",
  // Documento de identificação dos sócios/administradores
  doc_identificacao_socios: "Cópia de documento oficial com foto (RG, CNH ou equivalente) de quem administra a empresa e assina pela empresa. Deve estar válido e legível.",
  // Procuração / credenciamento do representante
  procuracao_credenciamento: "Documento necessário quando quem assina a proposta, os documentos ou o contrato não é sócio-administrador. A procuração deve dar poderes específicos para atuar em licitações, como formular lances, assinar documentos e interpor recursos. Verifique se o edital exige firma reconhecida ou assinatura digital.",
  // Autorização para funcionamento
  autorizacao_funcionamento: "Licença ou autorização emitida por órgão regulador quando a atividade do objeto depende dela. São exemplos a AFE da ANVISA, a autorização da Polícia Federal e o registro no MAPA. Sem essa autorização, a empresa não pode legalmente executar o objeto, e isso pode levar à inabilitação.",
  // Outras
  outras_juridica: "Documento de habilitação jurídica específico deste edital. Leia a descrição informada e, em caso de dúvida, consulte a SALUTTI.",

  // ---- Regularidade fiscal, social e trabalhista ----
  // Cartão CNPJ
  cartao_cnpj: "Comprovante de inscrição no Cadastro Nacional da Pessoa Jurídica, emitido no site da Receita Federal. A situação cadastral deve estar \"Ativa\", e as atividades (CNAE) devem ser compatíveis com o objeto licitado.",
  // Inscrição estadual / municipal
  inscricao_estadual_municipal: "Comprova que a empresa está cadastrada como contribuinte no Estado (ICMS), no caso de comércio e indústria, ou no Município (ISS), no caso de serviços. O edital indica qual das duas é exigida, conforme o tipo de objeto.",
  // CND Federal (RFB/PGFN)
  cnd_federal: "Certidão conjunta que comprova a regularidade com tributos federais e com a Dívida Ativa da União, incluindo as contribuições previdenciárias. É emitida no site da Receita Federal. A certidão \"positiva com efeitos de negativa\" também é aceita. Confira sempre a data de validade.",
  // CND Estadual
  cnd_estadual: "Certidão de regularidade com a Fazenda do Estado onde fica a sede da empresa. Alguns Estados emitem certidões separadas para débitos tributários e para Dívida Ativa. Nesses casos, emitir as duas.",
  // CND Municipal
  cnd_municipal: "Certidão de regularidade com a Fazenda do Município da sede da empresa. A validade e a forma de emissão variam de município para município.",
  // FGTS (CRF)
  fgts_crf: "Certificado de Regularidade do FGTS, emitido no site da Caixa Econômica Federal. Tem validade curta (em regra, 30 dias).",
  // CNDT (Certidão Trabalhista)
  cndt: "Certidão Negativa de Débitos Trabalhistas, emitida gratuitamente no site do TST. Comprova que a empresa não tem condenações trabalhistas não pagas.",
  // Outras
  outras_fiscal: "Certidão ou comprovante de regularidade específico deste edital. Veja a descrição informada.",

  // ---- Qualificação econômico-financeira ----
  // Balanço patrimonial e demonstrações contábeis
  balanco_patrimonial: "Demonstrações financeiras que comprovam a saúde econômica da empresa: Balanço Patrimonial e DRE (Demonstração do Resultado do Exercício). Em regra, a lei permite exigir os dois últimos exercícios sociais, e o edital define se basta o último ou se são necessários os dois. Podem ser exigidos na forma da ECD/SPED ou registrados na Junta Comercial. Empresas abertas no ano em curso podem apresentar o balanço de abertura.",
  // Índices econômico-financeiros
  indices_economico_financeiros: "Indicadores calculados a partir do balanço que medem a capacidade financeira da empresa:\nLG (Liquidez Geral): capacidade de pagar todas as dívidas;\nLC (Liquidez Corrente): capacidade de pagar as dívidas de curto prazo;\nSG (Solvência Geral): relação entre o total de bens e direitos e o total de dívidas.\nNormalmente se exige resultado igual ou superior a 1. Não atingir o mínimo pode causar inabilitação, salvo se o edital aceitar outra forma de comprovação, como capital ou patrimônio mínimo.",
  // Declaração do contador atestando os índices
  declaracao_contador: "Declaração assinada por contador com registro ativo no CRC, confirmando que a empresa atende aos índices exigidos no edital. Deve trazer os valores calculados e estar coerente com o balanço apresentado.",
  // Certidão de falência / recuperação judicial
  certidao_falencia: "Certidão emitida pelo distribuidor judicial da sede da empresa, comprovando que não há pedido de falência. O edital normalmente fixa um prazo máximo de emissão (por exemplo, 30, 60 ou 90 dias). Empresas em recuperação judicial devem avaliar o caso com a SALUTTI antes de participar.",
  // Capital social mínimo
  capital_social_minimo: "Exigência de que o capital social registrado no contrato social seja de, no mínimo, um valor ou percentual definido no edital. A lei limita essa exigência a 10% do valor estimado da contratação.",
  // Patrimônio líquido mínimo
  patrimonio_liquido_minimo: "Exigência de que o patrimônio líquido demonstrado no balanço seja de, no mínimo, um valor ou percentual definido no edital, também limitado a 10% do valor estimado. É comum servir como alternativa para quem não atinge os índices.",
  // Outras
  outras_economico_financeira: "Exigência econômico-financeira específica deste edital. Veja a descrição informada.",

  // ---- Qualificação técnica ----
  // Atestado de capacidade técnica
  atestado_capacidade_tecnica: "Documento emitido por cliente, público ou privado, declarando que a empresa já forneceu produtos ou prestou serviços semelhantes ao objeto de forma satisfatória. Deve conter a identificação do emitente, a descrição do que foi fornecido, as quantidades, o período e a assinatura. Pontos a verificar:\nse o edital aceita objeto similar ou exige objeto idêntico;\nse permite somar atestados para atingir a quantidade;\nqual é a quantidade mínima exigida (em regra, limitada a 50% do quantitativo licitado).",
  // Responsável técnico (CAT/ART)
  responsavel_tecnico: "Comprovação de que a empresa conta com profissional habilitado (por exemplo, engenheiro, químico ou farmacêutico) com experiência no tipo de serviço. É feita por CAT (Certidão de Acervo Técnico) ou por ART/RRT registrada no conselho. O vínculo do profissional com a empresa também costuma ser exigido (sócio, empregado ou contrato de prestação de serviços).",
  // Registro em conselho profissional
  registro_conselho_profissional: "Certidão de registro da empresa e/ou do responsável técnico no conselho que fiscaliza a atividade (CREA, CRQ, CRF, CRMV, CRA etc.). A certidão deve estar válida e com a anuidade em dia.",
  // Vistoria / visita técnica
  vistoria_visita_tecnica: "Visita ao local onde o serviço será executado ou o produto será entregue, para conhecer as condições do local.\nObrigatória: a falta da visita impede a habilitação.\nFacultativa: a empresa decide se faz.\nDeclaração substitutiva: a empresa declara que conhece as condições do local e assume os riscos, sem precisar visitar.\nAtenção ao agendamento e aos prazos definidos no edital.",
  // Indicação de equipe, instalações e equipamentos
  indicacao_equipe_instalacoes: "Declaração ou relação indicando o pessoal técnico, as instalações e os equipamentos que a empresa terá disponíveis para executar o contrato. Normalmente basta declarar a disponibilidade, sem comprovar a propriedade na fase de habilitação.",
  // Outras
  outras_tecnica: "Exigência técnica específica deste edital. Veja a descrição informada.",

  // ---- Declarações ----
  // Cumprimento dos requisitos de habilitação
  cumprimento_requisitos_habilitacao: "Declaração de que a empresa atende a todas as exigências de habilitação do edital e de que apresentará os documentos quando solicitados.",
  // Reserva de cargos para PcD e reabilitados
  reserva_cargos_pcd: "Declaração de que a empresa cumpre a cota legal de contratação de pessoas com deficiência e reabilitados da Previdência. A cota se aplica, em regra, a empresas com 100 ou mais empregados.",
  // Não emprego de menor
  nao_emprego_menor: "Declaração de que a empresa não emprega menores de 18 anos em trabalho noturno, perigoso ou insalubre, nem menores de 16 anos em qualquer trabalho, salvo como aprendiz a partir dos 14 anos.",
  // Enquadramento como ME/EPP
  enquadramento_me_epp: "Declaração de que a empresa se enquadra como Microempresa ou Empresa de Pequeno Porte, o que garante benefícios como desempate, cotas reservadas e prazo para regularizar pendências fiscais.\nAtenção: Só deve ser marcada se o enquadramento for real e o faturamento estiver dentro do limite legal. A declaração falsa gera sanções.",
  // Proposta compatível com custos trabalhistas
  proposta_compativel_custos_trabalhistas: "Declaração de que o preço ofertado cobre todos os custos trabalhistas previstos em lei e em convenções coletivas da categoria. É especialmente relevante em serviços com mão de obra.",
  // Inexistência de fato impeditivo
  inexistencia_fato_impeditivo: "Declaração de que não existe nenhuma situação que impeça a empresa de licitar ou contratar com a Administração, como sanção de suspensão, impedimento ou inidoneidade.",
  // Elaboração independente de proposta
  elaboracao_independente_proposta: "Declaração de que a proposta foi elaborada de forma independente, sem combinação ou troca de informações com outros concorrentes.",
  // Outras
  outras_declaracoes: "Declaração específica deste edital. Verifique o modelo anexo ao edital, quando houver.",

  // ---- Aceitação do produto (aba "Outras Exigências") ----
  // Amostra
  amostra: "Unidade do produto ofertado a ser entregue ao órgão para análise antes da aceitação da proposta. Deve ser idêntica ao produto cotado (mesma marca e modelo). O prazo de entrega e o local indicados devem ser respeitados, porque atrasos ou divergências levam à desclassificação.",
  // Catálogo / folder técnico
  catalogo_folder_tecnico: "Material do fabricante com imagens e características do produto, usado para comprovar que o item ofertado atende às especificações e destaca as informações exigidas no termo de referência.",
  // Ficha técnica do produto
  ficha_tecnica_produto: "Documento com as especificações detalhadas do produto: dimensões, composição, materiais, capacidade, normas atendidas etc. Deve demonstrar o atendimento, item por item, ao descritivo do edital.",
  // FISPQ / FDS
  fispq_fds: "Ficha de Informações de Segurança de Produtos Químicos (hoje chamada de FDS, Ficha com Dados de Segurança). Obrigatória para produtos químicos, como produtos de limpeza e saneantes. Informa composição, riscos, manuseio, armazenamento e primeiros socorros. É fornecida pelo fabricante.",
  // Laudo técnico / de ensaio
  laudo_tecnico_ensaio: "Relatório emitido por laboratório, preferencialmente acreditado, que comprova por meio de testes que o produto atende a determinada norma ou especificação. Poderá ser exigido no edital,  laboratório acreditado pelo INMETRO e se há prazo máximo de emissão.",
  // Certificação
  certificacao: "Comprovação de conformidade do produto ou da empresa com normas técnicas:\nINMETRO: certificação compulsória para diversos produtos, como brinquedos, EPIs e eletroeletrônicos;\nISO: certificação de sistema de gestão da empresa (por exemplo, ISO 9001);\nOutras: certificações setoriais indicadas no edital.",
  // Registro ANVISA
  registro_anvisa: "Comprovação de que o produto está registrado ou notificado na ANVISA, obrigatório para medicamentos, saneantes, cosméticos, produtos para saúde e alimentos específicos. A consulta é feita no site da ANVISA, e o registro deve estar válido.",
  // Registros específicos
  registros_especificos: "Outros registros obrigatórios conforme o tipo de produto, como MAPA (produtos agropecuários e veterinários), CA (Certificado de Aprovação de EPIs, do Ministério do Trabalho) e Exército ou Polícia Federal (produtos controlados).",
  // Licença / autorização específica
  licenca_autorizacao_especifica: "Licença exigida para comercializar, transportar ou armazenar determinados produtos, como licença ambiental, licença sanitária ou autorização para produtos controlados.",
  // Indicação de marca / modelo
  indicacao_marca_modelo: "Exigência de que a proposta informe claramente a marca e o modelo do produto ofertado. O produto entregue deve ser exatamente o indicado. A troca posterior depende de autorização do órgão.",
  // Garantia do produto / assistência técnica
  garantia_assistencia_tecnica: "Prazo mínimo de garantia exigido pelo edital e, quando aplicável, a obrigação de manter assistência técnica, própria ou credenciada, em determinada região.",
  // Instalação
  instalacao: "Obrigação de a empresa instalar ou montar o produto no local indicado pelo órgão. Envolve custos de mão de obra, deslocamento e, às vezes, responsável técnico.",
  // Outras
  outras_exigencias: "Exigência de aceitação específica deste edital. Veja a descrição informada.",
}

/** Explicação do item do checklist, ou undefined se ainda não houver texto. */
export function explicacaoDaExigencia(id: string): string | undefined {
  return EXPLICACAO_EXIGENCIAS[id]
}
