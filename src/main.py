import json
import os
import datetime
from typing import Optional, List
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext

# --- CONFIGURAÇÕES DE SEGURANÇA ---
# pwd_context transforma a senha em um código impossível de ler (hash)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# --- CONFIGURAÇÕES DE CAMINHO ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
CAMINHO_ESTOQUE = os.path.join(DATA_DIR, "estoque.json")
CAMINHO_USUARIOS = os.path.join(DATA_DIR, "usuarios.json")
CAMINHO_LOG = os.path.join(DATA_DIR, "historico_movimentacao.csv")

# --- MODELOS DE DADOS (SCHEMAS) ---
class UsuarioSchema(BaseModel):
    nome: str
    email: EmailStr
    senha: str

class LoginSchema(BaseModel):
    email: str
    senha: str

class Produto(BaseModel):
    codigo: str
    nome: str
    quantidade: int
    gaiola: str
    estoque_minimo: int

# --- DATABASE LAYER (PERSISTÊNCIA EM JSON) ---
def inicializar_banco():
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)
    for caminho in [CAMINHO_ESTOQUE, CAMINHO_USUARIOS]:
        if not os.path.exists(caminho):
            with open(caminho, "w", encoding="utf-8") as f:
                json.dump({}, f)

def carregar_dados(caminho):
    try:
        with open(caminho, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return {}

def salvar_dados(caminho, dados):
    with open(caminho, "w", encoding="utf-8") as f:
        json.dump(dados, f, indent=4, ensure_ascii=False)

# --- INICIALIZAÇÃO ---
app = FastAPI(title="BipFlow API", version="2.0")
inicializar_banco()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- ROTAS DE AUTENTICAÇÃO ---

@app.post("/usuarios")
async def cadastrar_usuario(u: UsuarioSchema):
    usuarios = carregar_dados(CAMINHO_USUARIOS)
    
    if u.email in usuarios:
        raise HTTPException(status_code=400, detail="Este e-mail já está cadastrado")
    
    # Criando hash da senha antes de salvar (Segurança de Mercado)
    hashed_password = pwd_context.hash(u.senha)
    
    usuarios[u.email] = {
        "nome": u.nome,
        "email": u.email,
        "senha": hashed_password
    }
    
    salvar_dados(CAMINHO_USUARIOS, usuarios)
    
    return {
        "status": "success",
        "usuario": {"nome": u.nome, "email": u.email}
    }

@app.post("/login")
async def login(dados: LoginSchema):
    usuarios = carregar_dados(CAMINHO_USUARIOS)
    
    user = usuarios.get(dados.email)
    
    # Verifica se usuário existe e se a senha "bate" com o hash salvo
    if not user or not pwd_context.verify(dados.senha, user["senha"]):
        raise HTTPException(status_code=401, detail="E-mail ou senha inválidos")
    
    return {
        "status": "success",
        "usuario": {
            "nome": user["nome"],
            "email": user["email"]
        }
    }

# --- ROTAS DE ESTOQUE ---

@app.get("/estoque")
async def listar_estoque():
    # Usamos carregar_dados passando o caminho do estoque
    return carregar_dados(CAMINHO_ESTOQUE)

@app.post("/produto/entrada")
async def entrada(prod: Produto):
    estoque = carregar_dados(CAMINHO_ESTOQUE)
    codigo = prod.codigo
    
    if codigo in estoque:
        # Se o produto já existe, soma a quantidade
        estoque[codigo]["quantidade"] += prod.quantidade
    else:
        # Se é novo, cria o registro completo
        estoque[codigo] = prod.dict()
    
    salvar_dados(CAMINHO_ESTOQUE, estoque)
    
    # Registro de log para auditoria
    registrar_log("ENTRADA", codigo, prod.nome, prod.quantidade)
    
    return {"status": "success", "item": estoque[codigo]}

# --- ROTA DE STATUS (SAÚDE DA API) ---
@app.get("/")
async def root():
    return {"status": "BipFlow API Online", "timestamp": datetime.datetime.now()}