import sqlite3

def cadastrar_usuario(username, senha):
    try:
        conexao = sqlite3.connect('bipflow.db')
        cursor = conexao.cursor()
        cursor.execute("INSERT INTO usuarios (username, senha) VALUES (?, ?)", (username, senha))
        conexao.commit()
        conexao.close()
        return True
    except sqlite3.IntegrityError:
        print("❌ Erro: Este usuário já existe!")
        return False

def realizar_login(username, senha):
    conexao = sqlite3.connect('bipflow.db')
    cursor = conexao.cursor()
    # Busca um usuário que combine nome E senha
    cursor.execute("SELECT * FROM usuarios WHERE username = ? AND senha = ?", (username, senha))
    usuario = cursor.fetchone()
    conexao.close()
    
    if usuario:
        return True 
    else:
        return False