/**
 * Ação de Cadastro de Novo Usuário
 * Envia os dados para o backend e prepara o login automático
 */
async function acaoCadastro() {
    const nome = document.getElementById('cad-nome-novo').value;
    const email = document.getElementById('cad-email-novo').value;
    const senha = document.getElementById('cad-senha-novo').value;

    // Validação simples antes de gastar banda de rede
    if (!nome || !email || !senha) {
        toast("Por favor, preencha todos os campos", "bg-amber-500 text-white");
        return;
    }

    try {
        // ATENÇÃO: Verifique se no seu Python a rota é /usuarios ou /cadastro
        const response = await fetch(`${API_URL}/usuarios`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, email, senha })
        });

        const data = await response.json();

        if (response.ok) {
            toast("Conta criada com sucesso!", "bg-emerald-500 text-white");
            
            // --- UX DE ELITE (Identificação Facilitada) ---
            showView('view-login');
            
            // Preenche o e-mail para o usuário não repetir o trabalho
            const campoEmailLogin = document.getElementById('login-email');
            campoEmailLogin.value = email;
            
            // Dá o foco na senha para ele apenas digitar e entrar
            setTimeout(() => {
                document.getElementById('login-senha').focus();
            }, 500); 

        } else {
            // Mostra o erro exato que o FastAPI enviou (ex: "E-mail já cadastrado")
            toast(data.detail || "Erro ao realizar cadastro", "bg-red-500 text-white");
        }
    } catch (error) {
        console.error("Erro no fetch:", error);
        toast("Servidor offline ou erro de conexão", "bg-red-600 text-white");
    }
}

/**
 * Ação de Login no Sistema
 * Autentica e salva a sessão localmente
 */
async function realizarLogin() {
    const email = document.getElementById('login-email').value;
    const senha = document.getElementById('login-senha').value;

    if (!email || !senha) {
        toast("Digite e-mail e senha", "bg-amber-500 text-white");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, senha })
        });

        const data = await response.json();

        if (response.ok) {
            // Salva o objeto do usuário no localStorage para persistência (F5)
            localStorage.setItem('bipflow_user', JSON.stringify(data.usuario));
            
            toast(`Bem-vindo, ${data.usuario.nome}!`, "bg-slate-900 text-white");
            
            // Atualiza a interface e navega para o Dashboard
            atualizarDadosUsuario(data.usuario.nome);
            showView('tela-menu');
        } else {
            toast(data.detail || "E-mail ou senha incorretos", "bg-red-500 text-white");
        }
    } catch (error) {
        console.error("Erro no login:", error);
        toast("Erro ao conectar com o servidor", "bg-red-600 text-white");
    }
}
# No seu arquivo Python
@app.post("/usuarios")
async def cadastrar_usuario(usuario: UsuarioSchema): # O nome deve bater com o JSON
    # sua lógica de salvar no banco...
    return {"message": "Usuário criado"}