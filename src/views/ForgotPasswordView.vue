<template>
  <main class="auth-container">
    <section class="auth-card">
      <header class="auth-header">
        <h1 class="auth-title">Recuperar Senha</h1>
        <p class="auth-subtitle">
          Informe seu e-mail para receber as instruções de redefinição.
        </p>
      </header>

      <ForgotPasswordForm @success="handleSuccess" />

      <footer class="auth-footer">
        <router-link :to="{ name: 'login' }" class="back-link">
          ← Voltar para o Login
        </router-link>
      </footer>
    </section>
  </main>
</template>

<script setup lang="ts">
import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm.vue' // Ajuste o caminho conforme sua estrutura

const handleSuccess = () => {
  // Lógica para mostrar um toast ou mensagem de sucesso global
  console.info('[BipFlow] Instruções enviadas com sucesso.')
}
</script>

<style scoped>
.auth-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 80vh;
  padding: 1.5rem;
}

.auth-card {
  width: 100%;
  max-width: 420px;
  background: white;
  padding: 2.5rem;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
}

.auth-header {
  text-align: center;
  margin-bottom: 2rem;
}

.auth-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: #1a1a1a;
  margin-bottom: 0.5rem;
}

.auth-subtitle {
  color: #666;
  font-size: 0.95rem;
}

.auth-footer {
  margin-top: 1.5rem;
  text-align: center;
}

.back-link {
  color: #4f46e5;
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 500;
  transition: color 0.2s;
}

.back-link:hover {
  color: #4338ca;
  text-decoration: underline;
}
</style>