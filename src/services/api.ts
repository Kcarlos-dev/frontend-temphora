import axios, { type InternalAxiosRequestConfig } from 'axios'
import type {
  Empresa,
  Colaborador,
  Ponto,
  PontoEmpresaPage,
  PagedResponse,
  Atestado,
  User,
  UserProfile,
} from '@/types'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('temphora_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  // FormData: não fixar Content-Type — o Safari (iOS) precisa do boundary gerado pelo navegador.
  // "multipart/form-data" sem boundary ou o default "application/json" quebram upload no iPhone.
  if (config.data instanceof FormData) {
    const h = config.headers
    if (h && typeof h.delete === 'function') {
      h.delete('Content-Type')
    }
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('temphora_token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

export const authApi = {
  login(email: string, password: string) {
    return api.post<{ token: string }>('/auth/login', { email, password })
  },
}

export const empresaApi = {
  get(idEmpresa: number) {
    return api.get<Empresa>(`/empresa/${idEmpresa}`)
  },
  create(data: Omit<Empresa, 'id'>) {
    return api.post<Empresa>('/empresa', data)
  },
  update(idEmpresa: number, data: Partial<Empresa>) {
    return api.put<Empresa>(`/empresa/${idEmpresa}`, data)
  },
  remove(idEmpresa: number) {
    return api.delete(`/empresa/${idEmpresa}`)
  },
}

export const colaboradorApi = {
  // Listagem paginada (default page=1, pageSize=10). A API devolve
  // { data, page, pageSize, hasMore } — se `hasMore` for true, ainda tem
  // colaborador para a próxima página.
  list(idEmpresa: number, page = 1, pageSize = 10) {
    return api.get<PagedResponse<Colaborador>>(`/colaborador/${idEmpresa}`, {
      params: { page, pageSize },
    })
  },
  getByCpf(idEmpresa: number, cpf: string) {
    return api.get<Colaborador>(
      `/colaborador/${idEmpresa}/${encodeURIComponent(cpf)}`,
    )
  },
  create(idEmpresa: number, data: Partial<Colaborador>) {
    return api.post<Colaborador>(`/colaborador/${idEmpresa}`, data)
  },
  update(idEmpresa: number, id: number, data: Partial<Colaborador>) {
    return api.put<Colaborador>(`/colaborador/${idEmpresa}/${id}`, data)
  },
  updateStatus(idEmpresa: number, id: number, status: string) {
    return api.patch<Colaborador>(`/colaborador/${idEmpresa}/${id}/status`, { status })
  },
  uploadFoto(idEmpresa: number, idColaborador: number, data: FormData) {
    return api.post<Colaborador>(
      `/colaborador/${idEmpresa}/${idColaborador}/upload-foto`,
      data,
    )
  },
}

export const pontoApi = {
  // Listagem paginada dos pontos de um colaborador (default page=1, pageSize=10).
  list(idEmpresa: number, idColaborador: number, page = 1, pageSize = 10) {
    return api.get<PagedResponse<Ponto>>(
      `/ponto/${idEmpresa}/${idColaborador}`,
      { params: { page, pageSize } },
    )
  },
  listByEmpresa(idEmpresa: number, page = 1, pageSize = 20) {
    return api.get<PontoEmpresaPage>(`/ponto/${idEmpresa}`, {
      params: { page, pageSize },
    })
  },
  create(idEmpresa: number, data: FormData) {
    return api.post<Ponto>(`/ponto/${idEmpresa}`, data)
  },
  update(idEmpresa: number, id: number, data: Partial<Ponto>) {
    return api.put<Ponto>(`/ponto/${idEmpresa}/${id}`, data)
  },
  remove(idEmpresa: number, id: number) {
    return api.delete(`/ponto/${idEmpresa}/${id}`)
  },
  exportCsv(idEmpresa: number, idColaborador: number, dataInicial: string, dataFinal: string) {
    return api.get(`/ponto/planilha/${idEmpresa}/${idColaborador}/${dataInicial}/${dataFinal}`, {
      responseType: 'blob',
    })
  },
}

export const userApi = {
  me() {
    return api.get<UserProfile>('/user/me')
  },
  create(
    idEmpresa: number,
    data: { email: string; password: string; name: string; role: string },
  ) {
    return api.post<{ message: string; user: User }>(
      `/user/${idEmpresa}`,
      data,
    )
  },
  updatePassword(
    idEmpresa: number,
    data: { email: string; password: string },
  ) {
    return api.put<{ message: string }>(`/user/${idEmpresa}`, data)
  },
}

export const atestadoApi = {
  /**
   * Lista atestados do colaborador pelo CPF, com paginação simples
   * (default page=1, pageSize=10). Quando a lista estiver vazia a API
   * agora retorna 200 com `data: []` em vez de 404.
   */
  listByCpf(idEmpresa: number, cpf: string, page = 1, pageSize = 10) {
    return api.get<PagedResponse<Atestado>>(
      `/atestado/${idEmpresa}/cpf/${encodeURIComponent(cpf)}`,
      { params: { page, pageSize } },
    )
  },
  /** multipart/form-data: id_colaborador, data_inicio, data_fim, status e arquivo no campo `arquivo` (o app exige anexo ao criar). */
  create(idEmpresa: number, idColaborador: number, data: FormData) {
    return api.post<Atestado>(`/atestado/${idEmpresa}/${idColaborador}`, data)
  },
  update(idEmpresa: number, id: number, data: Partial<Atestado>) {
    return api.put<Atestado>(`/atestado/${idEmpresa}/${id}`, data)
  },
  remove(idEmpresa: number, id: number) {
    return api.delete(`/atestado/${idEmpresa}/${id}`)
  },
}

export default api
