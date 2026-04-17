/** Remove tudo que não é dígito (CPF, telefone, CNPJ). */
export function onlyDigits(s: string): string {
  return s.replace(/\D/g, '')
}

export function normalizeEmail(s: string): string {
  return s.trim().toLowerCase()
}

/** Padrões para uso com a diretiva `v-maska` (maska). */
export const maskCpf = '###.###.###-##'

/** Fixo 8 dígitos + 9º dígito opcional (celular). */
export const maskPhoneBr = ['(##) ####-####', '(##) #####-####']

export const maskCnpj = '##.###.###/####-##'
