from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
import uvicorn
import os

# Importando com os nomes REAIS que o seu grep mostrou
from main import carregar_json, entrada  # Note que tirei 'registrar_saida' pois não apareceu no grep

app = FastAPI(title="BipFlow API Elite")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- MODELOS ---
class Usuario(BaseModel):
    nome: str
    email: str
    senha: str

class ProdutoSimples(BaseModel):
    codigo: str
    quantidade: int

# Banco em memória para o login funcionar enquanto não migramos o DB
USUARIOS_DB = {
    "admin@bipflow.com": {"senha": "123", "nome": "Administrador"}
}

# --- LOGIN (Para o auth.js funcionar) ---
@app.post("/auth/token")
async def login_api(form_data: OAuth2PasswordRequestForm = Depends()):
    user = USUARIOS_DB.get(form_data.username)
    if not user or form_data.password != user["senha"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais inválidas",
        )
    return {"access_token": f"token-{form_data.username}", "token_type": "bearer"}

# --- OPERAÇÕES DE ESTOQUE ---

@app.get("/")
def home():
    return {"status": "Online", "msg": "BipFlow pronto para bipar!"}

@app.post("/entrada/{codigo}")
async def confirmar_entrada(codigo: str, qtd: int = 1):
    try:
        # Criamos um objeto que a sua função 'entrada' do main.py espera
        # Baseado no seu grep: async def entrada(prod: Produto)
        from main import Produto 
        novo_prod = Produto(codigo=codigo, quantidade=qtd, nome="Produto Bipado")
        resultado = await entrada(novo_prod)
        return {"status": "sucesso", "dados": resultado}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# Rota de Saída (Como não vimos a def no main, criei um placeholder seguro)
@app.post("/saida/{codigo}")
async def confirmar_saida(codigo: str, qtd: int = 1):
    return {"status": "aviso", "msg": "Função registrar_saida não encontrada no main.py"}

if __name__ == "__main__":
    # Rodando o app diretamente
    uvicorn.run(app, host="127.0.0.1", port=8000)