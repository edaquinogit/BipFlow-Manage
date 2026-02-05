async function acaoCadastro() {
    const nome = document.getElementById('cad-nome-novo').value;
    const email = document.getElementById('cad-email-novo').value;
    const senha = document.getElementById('cad-senha-novo').value;

    if (!nome || !email || !senha) {
        toast("Por favor, preencha todos os campos", "bg-amber-500 text-white");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/cadastro`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, email, senha })
        });

        if (response.ok) {
            toast("Conta criada com sucesso!", "bg-emerald-500 text-white");
            
            // LOGICA DE IDENTIFICAÇÃO:
            // 1. Move para a tela de login
            showView('view-login');
            
            // 2. Preenche o e-mail automaticamente para o usuário não ter que digitar de novo
            document.getElementById('login-email').value = email;
            
            // 3. Dá foco na senha para ele apenas entrar
            document.getElementById('login-senha').focus();
            
        } else {
            const erro = await response.json();
            toast(erro.detail || "Erro ao cadastrar", "bg-red-500 text-white");
        }
    } catch (error) {
        toast("Servidor offline ou erro de conexão", "bg-red-500 text-white");
    }
}