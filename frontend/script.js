function acaoCadastro() {
    const nome = document.getElementById("cad-nome-novo").value;
    const email = document.getElementById("cad-email-novo").value;
    const senha = document.getElementById("cad-senha-novo").value;

    if (!nome || !email || !senha) {
        alert("Por favor, preencha todos os campos!");
        return;
    }

    // Aqui você pode futuramente enviar os dados para o backend
    console.log("Novo cadastro:", { nome, email, senha });
    alert("Conta criada com sucesso!");
}

// Função para alternar entre views
function showView(viewId) {
    document.querySelectorAll(".view-section").forEach(v => v.classList.add("hidden"));
    document.getElementById(viewId).classList.remove("hidden");
}
