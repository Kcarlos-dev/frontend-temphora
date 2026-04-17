<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const email = ref('')
const password = ref('')
const showPassword = ref(false)

async function handleLogin() {
  try {
    await auth.login(email.value, password.value)
    router.push('/dashboard')
  } catch {
    // error is set in store
  }
}
</script>

<template>
  <main class="login-page">
    <div class="login-card">
      <header class="login-header">
        <div class="brand">
          <img src="@/assets/temphora.png" alt="Temphora" class="brand-logo" />
          <span class="brand-name">Temphora</span>
        </div>
      </header>

      <section class="login-body">
        <h1>Bem-vindo</h1>
        <p class="subtitle">Acesse sua conta para gerenciar o ponto</p>

        <div v-if="auth.error" class="error-alert">
          <span class="material-symbols-rounded">error</span>
          {{ auth.error }}
        </div>

        <form @submit.prevent="handleLogin" class="login-form">
          <div class="field">
            <label for="email">Email</label>
            <div class="input-wrapper">
              <span class="material-symbols-rounded input-icon">mail</span>
              <input
                id="email"
                v-model="email"
                type="email"
                placeholder="seu@email.com"
                required
                autocomplete="email"
              />
            </div>
          </div>

          <div class="field">
            <label for="password">Senha</label>
            <div class="input-wrapper">
              <span class="material-symbols-rounded input-icon">lock</span>
              <input
                id="password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="••••••••"
                required
                autocomplete="current-password"
              />
              <button
                type="button"
                class="toggle-password"
                @click="showPassword = !showPassword"
              >
                <span class="material-symbols-rounded">
                  {{ showPassword ? 'visibility_off' : 'visibility' }}
                </span>
              </button>
            </div>
          </div>

          <button type="submit" class="btn-login" :disabled="auth.loading">
            <span v-if="auth.loading" class="spinner" />
            <span v-else>Entrar</span>
          </button>
        </form>
      </section>

      <footer class="login-footer">
        <p>&copy; 2026 Temphora</p>
      </footer>
    </div>
  </main>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(
    165deg,
    var(--color-bg) 0%,
    var(--color-tint-brand-bg) 42%,
    var(--color-bg) 100%
  );
  padding: 20px;
}

.login-card {
  width: 100%;
  max-width: 420px;
  background: var(--color-surface);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  border: 1px solid var(--color-border);
}

.login-header {
  padding: 24px 28px;
  border-bottom: 1px solid var(--color-border-light);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand-logo {
  width: 32px;
  height: 32px;
  border-radius: 8px;
}

.brand-name {
  font-weight: 700;
  font-size: 1.15rem;
  letter-spacing: -0.02em;
}

.login-body {
  padding: 36px 28px;
}

.login-body h1 {
  font-size: 1.6rem;
  font-weight: 800;
  margin-bottom: 6px;
  letter-spacing: -0.03em;
}

.subtitle {
  color: var(--color-text-secondary);
  font-size: 0.88rem;
  margin-bottom: 28px;
}

.error-alert {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: var(--radius-md);
  color: var(--color-danger);
  font-size: 0.85rem;
  font-weight: 500;
  margin-bottom: 20px;
}

.error-alert .material-symbols-rounded {
  font-size: 18px;
  flex-shrink: 0;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.field label {
  display: block;
  font-size: 0.82rem;
  font-weight: 600;
  margin-bottom: 6px;
  color: var(--color-text);
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 14px;
  font-size: 18px;
  color: var(--color-text-muted);
  pointer-events: none;
}

.input-wrapper input {
  width: 100%;
  padding: 12px 14px 12px 42px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  transition: all 0.15s;
  font-size: 0.9rem;
}

.input-wrapper input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(26, 26, 46, 0.08);
  background: var(--color-surface);
}

.toggle-password {
  position: absolute;
  right: 10px;
  padding: 4px;
  color: var(--color-text-muted);
}

.toggle-password .material-symbols-rounded {
  font-size: 18px;
}

.btn-login {
  width: 100%;
  padding: 13px;
  background: var(--color-primary);
  color: #fff;
  border-radius: var(--radius-md);
  font-weight: 600;
  font-size: 0.92rem;
  transition: opacity 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 46px;
  margin-top: 4px;
}

.btn-login:hover:not(:disabled) {
  opacity: 0.92;
}

.btn-login:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.login-footer {
  padding: 18px 28px;
  background: var(--color-bg);
  border-top: 1px solid var(--color-border-light);
  text-align: center;
  font-size: 0.75rem;
  color: var(--color-text-muted);
}
</style>
