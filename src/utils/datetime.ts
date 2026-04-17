/** `YYYY-MM-DD HH:mm:ss` no fuso local — mesmo padrão do campo `data_hora` ao bater ponto. */
export function formatDataHoraLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
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
