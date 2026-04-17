import axios from 'axios'
import type { Empresa, Colaborador, Ponto, Atestado } from '@/types'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('temphora_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
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
  list(idEmpresa: number) {
    return api.get<Colaborador[]>(`/colaborador/${idEmpresa}`)
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
}

export const pontoApi = {
  list(idEmpresa: number, idColaborador: number) {
    return api.get<Ponto[]>(`/ponto/${idEmpresa}/${idColaborador}`)
  },
  create(idEmpresa: number, data: FormData) {
    return api.post<Ponto>(`/ponto/${idEmpresa}`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
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

export const atestadoApi = {
  /** Lista atestados do colaborador pelo CPF (rota atual da API). */
  listByCpf(idEmpresa: number, cpf: string) {
    return api.get<Atestado[]>(
      `/atestado/${idEmpresa}/cpf/${encodeURIComponent(cpf)}`,
    )
  },
  /** multipart/form-data: id_colaborador, data_inicio, data_fim, status e arquivo no campo `arquivo` (o app exige anexo ao criar). */
  create(idEmpresa: number, idColaborador: number, data: FormData) {
    return api.post<Atestado>(`/atestado/${idEmpresa}/${idColaborador}`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  update(idEmpresa: number, id: number, data: Partial<Atestado>) {
    return api.put<Atestado>(`/atestado/${idEmpresa}/${id}`, data)
  },
  remove(idEmpresa: number, id: number) {
    return api.delete(`/atestado/${idEmpresa}/${id}`)
  },
}

export default api
