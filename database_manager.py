import sqlite3

def criar_banco():
    conexao = sqlite3.connect('bipflow.db')
    cursor = conexao.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT None UNIQUE,
            senha TEXT NOT None
        )
    ''')

    conexao.commit()
    conexao.close()
    print(" Banco de dados e tabela de usuarios prontos!")

if __name__ == "__main__":
    criar_banco()