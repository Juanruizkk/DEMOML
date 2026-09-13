# React Frontend Migration — Skeleton Plan

**Worktree:** `C:\JUAN RUIZ\Trabajos\DEMOML\.claude\worktrees\feat+react-frontend`
**Branch:** `worktree-feat+react-frontend`
**Goal:** Set up Vite + React + React Router + API client as `client/` folder alongside existing Fastify API. No redesign — functional skeleton that mirrors existing pages.

## Context

The project is a Fastify TypeScript API (port 3000) that currently serves static HTML from `public/`. The goal is to add a `client/` folder with a Vite + React SPA. Fastify stays as-is serving `/api/*`. In dev, Vite proxies `/api` to `:3000`. In prod, Fastify serves the built `client/dist/`.

**Existing pages to migrate (as React shells):**
- `/login` ← `public/index.html` (currently redirects to /demo, but login gate is in demo.html)
- `/demo` ← `public/demo.html` + `public/demo.js` + `public/demo.css`
- `/tenant` ← `public/tenant.html` + `public/tenant.js` + `public/tenant.css`
- `/admin` ← `public/admin.html` + `public/admin.js`
- `/onboarding` ← `public/onboarding.html`

**Existing API (keep untouched):**
- `POST /api/auth/login` → `{ token, user: { role, sellerId, ... } }`
- `GET /api/auth/me` → current user
- `GET /api/questions`, `POST /api/questions/:id/approve|reject`
- `GET /api/claims`, `POST /api/claims/:id/ack`
- `GET /api/events/stream` (SSE)
- `GET /api/tenant/settings`, `PUT /api/tenant/settings`
- `GET /api/admin/metrics`, `GET /api/admin/tenants`, etc.
- `POST /api/demo/seed`

---

## Task 1: Scaffold `client/` with Vite + React + TypeScript

- [ ] Create `client/` folder at repo root
- [ ] Create `client/package.json`:

```json
{
  "name": "meli-ai-client",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "react-router-dom": "^7.6.0"
  },
  "devDependencies": {
    "@types/react": "^19.1.8",
    "@types/react-dom": "^19.1.6",
    "@vitejs/plugin-react": "^4.5.2",
    "typescript": "~5.8.3",
    "vite": "^6.3.5"
  }
}
```

- [ ] Run `npm install` inside `client/`
- [ ] Create `client/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true
  },
  "include": ["src"]
}
```

- [ ] Create `client/tsconfig.app.json` (same as tsconfig.json, for Vite build)
- [ ] Create `client/vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/oauth': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../public/app',
    emptyOutDir: true,
  },
})
```

- [ ] Create `client/index.html`:

```html
<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MELI AI Assistant</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

## Task 2: API client module

- [ ] Create `client/src/api/client.ts`:

```typescript
const BASE = '/api'

function getToken(): string | null {
  return localStorage.getItem('token')
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? res.statusText)
  }
  return res.json()
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
}
```

---

## Task 3: Auth context

- [ ] Create `client/src/context/AuthContext.tsx`:

```typescript
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { api } from '../api/client'

interface User {
  id: string
  email: string
  name: string
  role: 'super_admin' | 'tenant' | 'demo'
  sellerId?: string
}

interface AuthState {
  user: User | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) { setLoading(false); return }
    api.get<User>('/auth/me')
      .then(setUser)
      .catch(() => { localStorage.removeItem('token'); setToken(null) })
      .finally(() => setLoading(false))
  }, [token])

  const login = async (email: string, password: string) => {
    const data = await api.post<{ token: string; user: User }>('/auth/login', { email, password })
    localStorage.setItem('token', data.token)
    setToken(data.token)
    setUser(data.user)
  }

  const logout = () => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
```

---

## Task 4: Router + page shells

- [ ] Create `client/src/main.tsx`:

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
)
```

- [ ] Create `client/src/App.tsx` with routes:

```typescript
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import DemoPage from './pages/DemoPage'
import TenantPage from './pages/TenantPage'
import AdminPage from './pages/AdminPage'
import OnboardingPage from './pages/OnboardingPage'

function PrivateRoute({ children, roles }: { children: JSX.Element; roles: string[] }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading">Cargando...</div>
  if (!user) return <Navigate to="/login" replace />
  if (!roles.includes(user.role)) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading">Cargando...</div>

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={defaultRoute(user.role)} replace /> : <LoginPage />} />
      <Route path="/demo" element={
        <PrivateRoute roles={['demo', 'super_admin']}>
          <DemoPage />
        </PrivateRoute>
      } />
      <Route path="/tenant" element={
        <PrivateRoute roles={['tenant', 'super_admin']}>
          <TenantPage />
        </PrivateRoute>
      } />
      <Route path="/admin" element={
        <PrivateRoute roles={['super_admin']}>
          <AdminPage />
        </PrivateRoute>
      } />
      <Route path="/onboarding" element={
        <PrivateRoute roles={['tenant', 'super_admin']}>
          <OnboardingPage />
        </PrivateRoute>
      } />
      <Route path="*" element={<Navigate to={user ? defaultRoute(user.role) : '/login'} replace />} />
    </Routes>
  )
}

function defaultRoute(role: string): string {
  if (role === 'super_admin') return '/admin'
  if (role === 'demo') return '/demo'
  return '/tenant'
}
```

- [ ] Create page shells — each is a minimal functional component. Content can be placeholder for now, but auth wiring must work.

**`client/src/pages/LoginPage.tsx`** — form with email/password, calls `auth.login()`, redirects on success.

**`client/src/pages/DemoPage.tsx`** — shows "Demo Dashboard" heading, seller ID from user, a "Preparar Demo" button that calls `POST /api/demo/seed`.

**`client/src/pages/TenantPage.tsx`** — shows "Portal Tenant" heading with tabs: Preguntas / Reclamos / Configuración.

**`client/src/pages/AdminPage.tsx`** — shows "Super Admin" heading, calls `GET /api/admin/metrics` and renders the metrics JSON.

**`client/src/pages/OnboardingPage.tsx`** — shows "Onboarding" heading, calls `GET /api/auth/onboarding-status`.

- [ ] Create `client/src/index.css` with minimal reset:

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, sans-serif; background: #0a0a0f; color: #e2e8f0; min-height: 100vh; }
.loading { display: flex; align-items: center; justify-content: center; height: 100vh; color: #64748b; }
```

---

## Task 5: Wire Fastify to serve React build in production

In `src/app.ts`, update the static file registration to serve from `public/app` (Vite build output) when in production, while keeping the old `public/` behavior as fallback:

- [ ] The existing `@fastify/static` registration at line ~67 already serves from `public/`. Add a catch-all route so React Router's client-side routing works:

```typescript
// After all /api routes, add SPA fallback:
app.setNotFoundHandler((_request, reply) => {
  reply.sendFile('app/index.html')
})
```

This means: any route not matched by `/api/*` serves the React app's index.html, letting React Router handle it client-side.

---

## Task 6: Add dev scripts to root package.json

- [ ] Add to `package.json` scripts:

```json
"client:dev": "cd client && npm run dev",
"client:build": "cd client && npm run build",
"dev:full": "concurrently \"npm run dev\" \"npm run client:dev\""
```

- [ ] Install `concurrently` as devDependency if adding `dev:full`.

---

## Task 7: Verify

- [ ] `cd client && npm run dev` starts Vite at `:5173`
- [ ] Navigate to `http://localhost:5173/login` — shows login form
- [ ] Login with `demo@melibot.com` / `Demo123456!` — redirects to `/demo`
- [ ] Login with super admin credentials — redirects to `/admin`
- [ ] Navigating to `/` redirects to correct page based on role
- [ ] `POST /api/demo/seed` works from the demo page button
- [ ] `cd client && npm run build` produces `public/app/` with `index.html`
- [ ] With Fastify running, `http://localhost:3000/app/` serves the React app

---

## Notes

- Do NOT redesign the UI — minimal functional shells only
- Do NOT delete `public/*.html` yet — they stay as fallback during transition
- Do NOT change any files in `src/` (Fastify API) except the SPA fallback in `app.ts`
- The `client/` folder is self-contained; the existing TypeScript project is separate
