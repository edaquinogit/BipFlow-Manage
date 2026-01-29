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
SECRET_KEY = "BIPFLOW_ULTRA_SECRET" # Em produção, use variáveis de ambiente
ALGORITHM = "HS256"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# --- CONFIGURAÇÕES DE CAMINHO ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
CAMINHO_ESTOQUE = os.path.join(DATA_DIR, "estoque.json")
CAMINHO_LOG = os.path.join(DATA_DIR, "historico_movimentacao.csv")

# --- MODELOS DE DADOS (PYDANTIC) ---
class UserLogin(BaseModel):
    email: str
    password: str

class Produto(BaseModel):
    codigo: str
    nome: str
    quantidade: int
    gaiola: str
    estoque_minimo: int

# --- DATABASE LAYER (PERSISTÊNCIA) ---
def garantir_pasta_data():
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)

def carregar_estoque():
    garantir_pasta_data()
    try:
        with open(CAMINHO_ESTOQUE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}

def salvar_estoque(estoque):
    with open(CAMINHO_ESTOQUE, "w", encoding="utf-8") as f:
        json.dump(estoque, f, indent=4, ensure_ascii=False)

def registrar_log(acao, codigo, nome, qtd, usuario="sistema"):
    data_hora = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    existe = os.path.exists(CAMINHO_LOG)
    with open(CAMINHO_LOG, "a", encoding="utf-8") as f:
        if not existe:
            f.write("Data;Usuario;Acao;Codigo;Produto;Qtd\n")
        f.write(f"{data_hora};{usuario};{acao};{codigo};{nome};{qtd}\n")

# --- AUTENTICAÇÃO ---
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.datetime.utcnow() + datetime.timedelta(hours=8)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None: raise HTTPException(status_code=401)
        return email
    except JWTError:
        raise HTTPException(status_code=401, detail="Sessão expirada")

# --- API APP ---
app = FastAPI(title="BipFlow API", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- ROTAS ---

@app.post("/login")
async def login(user: UserLogin):
    # Simulação de usuário (Em prod, use um DB)
    if user.email == "admin@bipflow.com" and user.password == "admin123":
        token = create_access_token(data={"sub": user.email})
        return {"access_token": token, "token_type": "bearer"}
    raise HTTPException(status_code=401, detail="E-mail ou senha incorretos")

@app.get("/estoque")
async def listar_estoque(user: str = Depends(get_current_user)):
    return carregar_estoque()

@app.post("/produto/entrada")
async def entrada(prod: Produto, user: str = Depends(get_current_user)):
    estoque = carregar_estoque()
    codigo = prod.codigo
    
    if codigo in estoque:
        estoque[codigo]["quantidade"] += prod.quantidade
    else:
        estoque[codigo] = prod.dict()
    
    salvar_estoque(estoque)
    registrar_log("ENTRADA/CADASTRO", codigo, prod.nome, prod.quantidade, user)
    return {"message": "Sucesso", "item": estoque[codigo]}

@app.get("/relatorio/reposicao")
async def relatorio(user: str = Depends(get_current_user)):
    estoque = carregar_estoque()
    return [info for info in estoque.values() if info["quantidade"] <= info["estoque_minimo"]]