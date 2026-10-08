/**
 * Estados e municípios do Brasil para os formulários.
 *
 * Os 27 estados (UF) ficam fixos aqui. Os municípios vêm da API pública do
 * IBGE (https://servicodados.ibge.gov.br/api/v1/localidades), gratuita e
 * sem chave — mesma ideia do ViaCEP: não depende do Supabase. A lista de
 * cada estado é buscada uma única vez e guardada em memória.
 */

export const ESTADOS_BRASIL: Array<{ value: string; label: string }> = [
  { value: 'AC', label: 'AC - Acre' },
  { value: 'AL', label: 'AL - Alagoas' },
  { value: 'AP', label: 'AP - Amapá' },
  { value: 'AM', label: 'AM - Amazonas' },
  { value: 'BA', label: 'BA - Bahia' },
  { value: 'CE', label: 'CE - Ceará' },
  { value: 'DF', label: 'DF - Distrito Federal' },
  { value: 'ES', label: 'ES - Espírito Santo' },
  { value: 'GO', label: 'GO - Goiás' },
  { value: 'MA', label: 'MA - Maranhão' },
  { value: 'MT', label: 'MT - Mato Grosso' },
  { value: 'MS', label: 'MS - Mato Grosso do Sul' },
  { value: 'MG', label: 'MG - Minas Gerais' },
  { value: 'PA', label: 'PA - Pará' },
  { value: 'PB', label: 'PB - Paraíba' },
  { value: 'PR', label: 'PR - Paraná' },
  { value: 'PE', label: 'PE - Pernambuco' },
  { value: 'PI', label: 'PI - Piauí' },
  { value: 'RJ', label: 'RJ - Rio de Janeiro' },
  { value: 'RN', label: 'RN - Rio Grande do Norte' },
  { value: 'RS', label: 'RS - Rio Grande do Sul' },
  { value: 'RO', label: 'RO - Rondônia' },
  { value: 'RR', label: 'RR - Roraima' },
  { value: 'SC', label: 'SC - Santa Catarina' },
  { value: 'SP', label: 'SP - São Paulo' },
  { value: 'SE', label: 'SE - Sergipe' },
  { value: 'TO', label: 'TO - Tocantins' },
]

const cacheMunicipios = new Map<string, string[]>()

/** Municípios de uma UF, em ordem alfabética. */
async function listarMunicipios(uf: string): Promise<string[]> {
  const sigla = uf.trim().toUpperCase()
  const emCache = cacheMunicipios.get(sigla)
  if (emCache) return emCache

  const resposta = await fetch(
    `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${encodeURIComponent(sigla)}/municipios?orderBy=nome`
  )
  if (!resposta.ok) throw new Error('Não foi possível carregar a lista de municípios.')
  const dados = (await resposta.json()) as Array<{ nome: string }>
  const nomes = dados.map((m) => m.nome).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  cacheMunicipios.set(sigla, nomes)
  return nomes
}

/** Minúsculas e sem acento — para comparar "sao paulo" com "São Paulo". */
export function normalizarNomeLocal(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

export const ibgeService = { listarMunicipios }
