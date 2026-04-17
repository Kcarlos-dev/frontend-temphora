# Temphora — Frontend

SPA em Vue 3 para o sistema de gestão de ponto e RH **Temphora**. PWA mobile-first com sidebar (desktop) e bottom navigation (mobile).

## Stack

- **Vue 3** + Composition API (`<script setup>`)
- **Vue Router 5** — rotas com guards de autenticação e roles
- **Pinia** — store de estado (auth, empresa)
- **Axios** — cliente HTTP para a API REST
- **Vite 8** — bundler + dev server
- **vite-plugin-pwa** — service worker, manifest e cache offline
- **TypeScript**

## Requisitos

- Node.js `^20.19.0 || >=22.12.0`
- Backend da API rodando (padrão `http://localhost:4000`)

## Instalação

```bash
npm install
```

## Desenvolvimento

```bash
npm run dev
```

O dev server sobe em `http://localhost:5173`. As chamadas a `/api` são automaticamente redirecionadas para `http://localhost:4000` via proxy configurado no `vite.config.ts`.

## Build

```bash
npm run build-only
```

Os arquivos de produção são gerados em `dist/`.

## Estrutura

```
src/
├── assets/
│   └── main.css              # Design system (CSS variables, reset, transições)
├── components/
│   └── layout/
│       ├── AppSidebar.vue     # Sidebar dark — visível em desktop (≥769px)
│       ├── AppBottomNav.vue   # Bottom tab bar — visível em mobile (≤768px)
│       └── AppLayout.vue      # Shell que compõe sidebar + conteúdo + bottom nav
├── services/
│   └── api.ts                 # Instância Axios + funções para cada endpoint
├── stores/
│   └── auth.ts                # Store Pinia — login, JWT decode, logout
├── types/
│   └── index.ts               # Interfaces TypeScript (User, Empresa, Colaborador, Ponto, Atestado)
├── views/
│   ├── ViewLogin.vue          # Tela de login
│   ├── ViewDashboard.vue      # Dashboard com stats e timeline do dia
│   ├── ViewPonto.vue          # Registro de ponto (foto, geolocalização, export CSV)
│   ├── ViewColaboradores.vue  # CRUD de colaboradores com filtros e busca
│   ├── ViewAtestados.vue      # Gestão de atestados médicos
│   └── ViewEmpresa.vue        # Dados da empresa (visualizar/editar)
├── router/
│   └── index.ts               # Rotas + navigation guards
├── App.vue                    # Root component
└── main.ts                    # Entry point (Pinia + Router)
```

## Telas e Rotas

| Rota               | View                 | Acesso                  |
|---------------------|----------------------|-------------------------|
| `/login`           | ViewLogin            | Pública                 |
| `/dashboard`       | ViewDashboard        | Autenticado             |
| `/ponto`           | ViewPonto            | Autenticado             |
| `/colaboradores`   | ViewColaboradores    | admin, root, rh         |
| `/atestados`       | ViewAtestados        | Autenticado             |
| `/empresa`         | ViewEmpresa          | admin, root, rh         |

## PWA

A aplicação é instalável em dispositivos móveis. O `vite-plugin-pwa` gera automaticamente:

- `manifest.webmanifest` — nome, ícones, cores, orientação
- Service worker (Workbox) — precache dos assets + cache `NetworkFirst` para `/api`

Para que os ícones do PWA funcionem, coloque `temphora-192.png` e `temphora-512.png` na pasta `public/`.

## Variáveis de Ambiente

| Variável  | Onde             | Descrição                                    |
|-----------|------------------|----------------------------------------------|
| `API_URL` | `.env` / Docker  | URL do backend para proxy reverso de `/api`  |

Crie um arquivo `.env` na raiz do projeto com:

```
API_URL=https://url-do-seu-backend
```

> O `.env` já está no `.gitignore` para não vazar credenciais. Use `.env.example` como referência.

Em desenvolvimento o proxy é configurado diretamente no `vite.config.ts` (seção `server.proxy`) e aponta para `http://localhost:4000`.

## Docker

O projeto inclui um `Dockerfile` multi-stage (Node build + nginx) e um entrypoint que lê `API_URL` do ambiente na hora do boot do container.

### Build da imagem

```bash
docker build -t temphora-frontend .
```

### Rodar localmente com `.env`

```bash
docker run --env-file .env -p 8080:8080 temphora-frontend
```

O nginx sobe na porta **8080**, serve os arquivos estáticos do Vue e faz proxy reverso de `/api/` para o valor de `API_URL`.

## Deploy (Cloud Run)

### Opção 1 — via gcloud builds

```bash
gcloud builds submit --tag gcr.io/SEU_PROJETO/temphora-frontend

gcloud run deploy temphora-frontend \
  --image gcr.io/SEU_PROJETO/temphora-frontend \
  --port 8080 \
  --set-env-vars API_URL=https://url-do-backend \
  --allow-unauthenticated
```

### Opção 2 — via Docker + Artifact Registry

```bash
docker build -t us-docker.pkg.dev/SEU_PROJETO/REPO/temphora-frontend .
docker push us-docker.pkg.dev/SEU_PROJETO/REPO/temphora-frontend

gcloud run deploy temphora-frontend \
  --image us-docker.pkg.dev/SEU_PROJETO/REPO/temphora-frontend \
  --port 8080 \
  --set-env-vars API_URL=https://url-do-backend \
  --allow-unauthenticated
```

No Cloud Run, defina `API_URL` como variável de ambiente do serviço (via console ou `--set-env-vars`). O entrypoint do container injeta esse valor no nginx automaticamente antes de iniciar.

**Login /api falhando no Cloud Run:** o nginx não deve enviar `Host` com o hostname do *frontend* para o backend (o serviço da API no Run espera o próprio host). A configuração atual deixa o `Host` ser o do upstream. Confira também se `API_URL` é a URL **HTTPS** completa do serviço da API (sem `/` no final), por exemplo `https://api-temphora-xxxxx.us-central1.run.app`.
