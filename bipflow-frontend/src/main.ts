import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import { Logger } from "./services/logger";
import { buildErrorContext, type ApplicationError } from "./types/errors";
import "./assets/main.css";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1"]);

function normalizeLocalLoopbackHost(): void {
  if (!import.meta.env.DEV) {
    return;
  }

  const currentHost = window.location.hostname;
  if (!LOOPBACK_HOSTS.has(currentHost)) {
    return;
  }

  const canonicalHost = (import.meta.env.VITE_DEV_CANONICAL_HOST as string | undefined)?.trim() || "localhost";
  if (!LOOPBACK_HOSTS.has(canonicalHost) || canonicalHost === currentHost) {
    return;
  }

  const target = `${window.location.protocol}//${canonicalHost}${window.location.port ? `:${window.location.port}` : ""}${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.replace(target);
}

normalizeLocalLoopbackHost();

/**
 * 🚨 Environment Validation
 * Prevent silent failures due to missing configuration
 */
if (!import.meta.env.VITE_API_URL && import.meta.env.MODE !== 'test') {
  Logger.error("VITE_API_URL is not defined", {
    expected: "VITE_API_URL=http://127.0.0.1:8000/api/",
    mode: import.meta.env.MODE,
  });
  throw new Error("VITE_API_URL environment variable is required but not set.");
}

/**
 * 🛡️ Global Error Boundary
 * Catch Vue internal failures and prevent silent app crashes
 */
const app = createApp(App);

// Global error handler for Vue-specific errors
app.config.errorHandler = (error: unknown, _instance, info) => {
  // Deliberately drop the component instance from the logged context: it
  // carries the crashed component's live reactive state, including any
  // bound password/MFA-code v-model values -- printing it would defeat the
  // point of never logging raw form input.
  Logger.error("Vue error boundary triggered", {
    ...buildErrorContext(error as ApplicationError),
    info,
  });

  // Check for common deadlock indicators
  if (error instanceof Error) {
    if (error.message.includes('Loading chunk') || error.message.includes('ChunkLoadError')) {
      Logger.warn("Potential chunk loading deadlock detected", {
        message: error.message,
      });
    }

    if (error.message.includes('Maximum call stack size exceeded')) {
      Logger.warn("Infinite recursion detected", {
        message: error.message,
      });
    }
  }

  // In development, re-throw to see full stack trace
  if (import.meta.env.DEV) {
    throw error;
  }

  // In production, you might want to send to error reporting service
  // reportErrorToService(error, { instance, info });
};

/**
 * 🐛 Development Debugging Enhancements
 */
if (import.meta.env.DEV) {
  // Expose app instance for debugging
  (window as Window & { vueApp?: typeof app; vueRouter?: typeof router }).vueApp = app;
  (window as Window & { vueApp?: typeof app; vueRouter?: typeof router }).vueRouter = router;

  Logger.info("BipFlow frontend initialized in development mode", {
    debugHelpers: ["window.vueApp", "window.vueRouter"],
  });
}

// Inicialização da aplicação Vue
app.use(router);
app.mount("#app");

// 💡 Dica de NY: Deixamos o main.ts limpo para que o roteador
// e os componentes gerenciem seus próprios dados e ciclos de vida.
