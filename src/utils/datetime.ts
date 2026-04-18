/** `YYYY-MM-DD HH:mm:ss` no fuso local — mesmo padrão do campo `data_hora` ao bater ponto. */
export function formatDataHoraLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/**
 * Converte um `data_hora` vindo da API em `Date` no fuso local.
 *
 * Aceita tanto "YYYY-MM-DD HH:mm:ss" (formato que a API devolve agora, sem
 * conversão de fuso) quanto ISO com 'Z'/offset (caso algum endpoint antigo
 * ainda serialize como UTC). Sem isso, o `new Date("YYYY-MM-DD HH:mm:ss")`
 * quebra no Safari e no Firefox interpretava como UTC, atrasando 3h no Brasil.
 */
export function parseDataHora(s: string): Date {
  if (!s) return new Date(NaN)
  // Já tem informação de fuso (Z ou ±HH:MM) — confia na string.
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(s)) {
    return new Date(s)
  }
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/)
  if (m) {
    return new Date(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4]),
      Number(m[5]),
      Number(m[6]),
    )
  }
  return new Date(s)
}

/** Input `type="date"` (`YYYY-MM-DD`) → início do dia no horário local. */
export function inicioDiaLocalFromInputDate(dateStr: string): Date {
  const parts = dateStr.split('-')
  const y = Number(parts[0])
  const mo = Number(parts[1])
  const d = Number(parts[2])
  return new Date(y, mo - 1, d, 0, 0, 0)
}

/** Input `type="date"` → último instante do dia no horário local. */
export function fimDiaLocalFromInputDate(dateStr: string): Date {
  const parts = dateStr.split('-')
  const y = Number(parts[0])
  const mo = Number(parts[1])
  const d = Number(parts[2])
  return new Date(y, mo - 1, d, 23, 59, 59)
}
