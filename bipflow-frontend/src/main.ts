import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import "./assets/main.css";

/**
 * 🚨 Environment Validation
 * Prevent silent failures due to missing configuration
 */
if (!import.meta.env.VITE_API_URL && import.meta.env.MODE !== 'test') {
  console.error("❌ CRITICAL: VITE_API_URL is not defined. Please check your environment variables.");
  console.error("💡 Expected: VITE_API_URL=http://127.0.0.1:8000/api/ (or your Django API URL)");
  throw new Error("VITE_API_URL environment variable is required but not set.");
}

/**
 * 🛡️ Global Error Boundary
 * Catch Vue internal failures and prevent silent app crashes
 */
const app = createApp(App);

// Global error handler for Vue-specific errors
app.config.errorHandler = (error: unknown, instance, info) => {
  console.group('🚨 Vue Error Boundary');
  console.error('Error:', error);
  console.error('Component Instance:', instance);
  console.error('Error Info:', info);

  // Check for common deadlock indicators
  if (error instanceof Error) {
    if (error.message.includes('Loading chunk') || error.message.includes('ChunkLoadError')) {
      console.error('⚠️ Potential chunk loading deadlock detected');
      console.error('💡 This may indicate circular dependencies or unresolved async components');
    }

    if (error.message.includes('Maximum call stack size exceeded')) {
      console.error('⚠️ Infinite recursion detected - possible redirect loop');
      console.error('💡 Check router guards and axios interceptors for circular logic');
    }
  }

  console.groupEnd();

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
  (window as any).vueApp = app;
  (window as any).vueRouter = router;

  console.info('🚀 BipFlow Frontend initialized in development mode');
  console.info('💡 Debug helpers available: window.vueApp, window.vueRouter');
}

// Inicialização da aplicação Vue
app.use(router);
app.mount("#app");

// 💡 Dica de NY: Deixamos o main.ts limpo para que o roteador
// e os componentes gerenciem seus próprios dados e ciclos de vida.
