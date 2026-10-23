// src/utils/cnpj.ts
//
// Utilitários de CNPJ (Cadastro Nacional da Pessoa Jurídica) para os campos
// digitados na tela: máscara 00.000.000/0000-00 e extração dos 14 números
// (é assim que o banco guarda). Não valida os dígitos verificadores: o campo
// é de identificação do órgão e fica opcional.

export function somenteDigitosCnpj(texto: string): string {
  return texto.replace(/\D/g, '').slice(0, 14);
}

export function formatarCnpj(texto: string): string {
  const d = somenteDigitosCnpj(texto);
  const partes = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 8), d.slice(8, 12), d.slice(12, 14)];
  let r = partes[0];
  if (partes[1]) r += `.${partes[1]}`;
  if (partes[2]) r += `.${partes[2]}`;
  if (partes[3]) r += `/${partes[3]}`;
  if (partes[4]) r += `-${partes[4]}`;
  return r;
}
