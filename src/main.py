import json
import os
import datetime
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from jose import JWTError, jwt
from passlib.context import CryptContext

# --- CONFIGURAÇÕES DE SEGURANÇA ---
SECRET_KEY = "BIPFLOW_ULTRA_SECRET"
ALGORITHM = "HS256"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# --- CONFIGURAÇÕES DE CAMINHO ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
CAMINHO_ESTOQUE = os.path.join(DATA_DIR, "estoque.json")
CAMINHO_USUARIOS = os.path.join(DATA_DIR, "usuarios.json") # Novo arquivo
CAMINHO_LOG = os.path.join(DATA_DIR, "historico_movimentacao.csv")

# --- MODELOS DE DADOS ---
class UserLogin(BaseModel):
    email: str
    password: str

class UserCreate(BaseModel): # Modelo para o Cadastro
    nome: str
    email: str
    senha: str

class Produto(BaseModel):
    codigo: str
    nome: str
    quantidade: int
    gaiola: str
    estoque_minimo: int

# --- DATABASE LAYER ---
def garantir_pasta_data():
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)

def carregar_json(caminho):
    garantir_pasta_data()
    try:
        with open(caminho, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}

def salvar_json(caminho, dados):
    with open(caminho, "w", encoding="utf-8") as f:
        json.dump(dados, f, indent=4, ensure_ascii=False)

# --- AUTENTICAÇÃO ---
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.datetime.utcnow() + datetime.timedelta(hours=8)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# --- API APP ---
app = FastAPI(title="BipFlow API", version="2.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- ROTAS DE USUÁRIO ---

@app.post("/cadastro")
async def cadastro(user: UserCreate):
    usuarios = carregar_json(CAMINHO_USUARIOS)
    if user.email in usuarios:
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")
    
    # Salva a senha (em prod usaríamos pwd_context.hash(user.senha))
    usuarios[user.email] = {"nome": user.nome, "senha": user.senha}
    salvar_json(CAMINHO_USUARIOS, usuarios)
    return {"message": "Usuário criado com sucesso"}

@app.post("/login")
async def login(user: UserLogin):
    usuarios = carregar_json(CAMINHO_USUARIOS)
    
    # Verifica no JSON ou o admin padrão
    if (user.email == "admin@bipflow.com" and user.password == "admin123") or \
       (user.email in usuarios and usuarios[user.email]["senha"] == user.password):
        
        token = create_access_token(data={"sub": user.email})
        return {"access_token": token, "token_type": "bearer"}
    
    raise HTTPException(status_code=401, detail="E-mail ou senha incorretos")

# --- ROTAS DE ESTOQUE (Mantidas) ---
@app.get("/estoque")
async def listar_estoque():
    return carregar_json(CAMINHO_ESTOQUE)

@app.post("/produto/entrada")
async def entrada(prod: Produto):
    estoque = carregar_json(CAMINHO_ESTOQUE)
    codigo = prod.codigo
    if codigo in estoque:
        estoque[codigo]["quantidade"] += prod.quantidade
    else:
        estoque[codigo] = prod.dict()
    salvar_json(CAMINHO_ESTOQUE, estoque)
    return {"message": "Sucesso"}