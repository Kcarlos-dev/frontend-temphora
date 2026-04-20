export interface User {
  id: number
  name: string
  email: string
  role: string
}

export interface AuthPayload {
  userId: number
  empresaId: number | null
  colaboradorId: number | null
  email: string
  role: string
  status: string | null
}

export interface Empresa {
  id: number
  enterprise: string
  cnpj: string
  email: string
  phone: string | null
}

export interface Colaborador {
  id: number
  id_empresa: number
  id_user: number
  full_name: string
  cpf: string | null
  phone: string | null
  position: string | null
  status: 'ativo' | 'inativo' | 'ferias' | 'desligado'
  foto?: string | null
  foto_url?: string | null
}

export interface UserProfile {
  id_user: number
  id_empresa: number | null
  id_colaborador: number | null
  name: string | null
  full_name: string | null
  cpf: string | null
  email: string
  role: string
  status: string | null
  foto: string | null
  foto_url: string | null
}

export interface Ponto {
  id: number
  id_colaborador: number
  tipo: string
  data_hora: string
  latitude: number | null
  longitude: number | null
  foto: string | null
  foto_url?: string | null
  colaborador_nome?: string | null
  colaborador_cpf?: string | null
}

export interface PontoEmpresaPage {
  data: Ponto[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// Paginação simples (hasMore em vez de total) usada em listagens onde fazer
// COUNT(*) seria caro. Backend devolve `pageSize + 1` e fatia pra detectar
// se existe próxima página.
export interface PagedResponse<T> {
  data: T[]
  page: number
  pageSize: number
  hasMore: boolean
}

export interface Atestado {
  id: number
  id_colaborador: number
  data_inicio: string
  data_fim: string
  arquivo: string | null
  /** URL assinada (GCS) para exibir o anexo — preenchida pela API. */
  arquivo_url?: string | null
  status: string
}

export interface ApiError {
  message: string
  status?: number
}
