import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './assets/main.css' 

// Inicialização da aplicação Vue
const app = createApp(App)

app.use(router)
app.mount('#app')

// 💡 Dica de NY: Deixamos o main.ts limpo para que o roteador 
// e os componentes gerenciem seus próprios dados e ciclos de vida.