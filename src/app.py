import json
import os
import datetime
import shutil
from typing import Optional, List, Dict
from fastapi import FastAPI, HTTPException, Depends, status, UploadFile, File, Form
from fastapi.security import OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from jose import JWTError, jwt
from passlib.context import CryptContext

# 1. CONFIGURAÇÕES BÁSICAS (Defina tudo antes de usar)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads", "perfis")

SECRET_KEY = "BIPFLOW_PRO_SECRET_2026"
ALGORITHM = "HS256"

# 2. INICIALIZAÇÃO DE SEGURANÇA E APP
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")
app = FastAPI(title="BipFlow Manage PRO", version="3.0")

# 3. CAMINHOS DE ARQUIVOS
CAMINHO_ESTOQUE = os.path.join(DATA_DIR, "estoque.json")
CAMINHO_LOG = os.path.join(DATA_DIR, "historico_movimentacao.csv")
USUARIOS_DB_PATH = os.path.join(DATA_DIR, "usuarios.json")

# Garantir que pastas existam
for pasta in [DATA_DIR, UPLOAD_DIR]:
    if not os.path.exists(pasta):
        os.makedirs(pasta)

# 4. MODELOS DE DADOS
class UserLogin(BaseModel):
    email: str
    password: str

class Produto(BaseModel):
    codigo: str
    nome: str
    quantidade: int
    gaiola: str
    estoque_minimo: int = 5

class Movimentacao(BaseModel):
    codigo: str
    quantidade: int

# 5. FUNÇÕES AUXILIARES (DATABASE LAYER)
def carregar_usuarios():
    try:
        with open(USUARIOS_DB_PATH, "r", encoding="utf-8") as f: return json.load(f)
    except: return {}

def salvar_usuarios(usuarios):
    with open(USUARIOS_DB_PATH, "w", encoding="utf-8") as f: json.dump(usuarios, f, indent=4)

def carregar_estoque() -> Dict:
    try:
        with open(CAMINHO_ESTOQUE, "r", encoding="utf-8") as f: return json.load(f)
    except: return {}

def salvar_estoque(estoque):
    with open(CAMINHO_ESTOQUE, "w", encoding="utf-8") as f:
        json.dump(estoque, f, indent=4, ensure_ascii=False)

def registrar_log(acao, codigo, nome, qtd, usuario):
    data_hora = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(CAMINHO_LOG, "a", encoding="utf-8") as f:
        f.write(f"{data_hora};{usuario};{acao};{codigo};{nome};{qtd}\n")

# 6. SEGURANÇA (JWT)
async def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Sessão expirada.")

# CORS
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# 7. ROTAS DE AUTENTICAÇÃO E CADASTRO

@app.post("/auth/signup")
async def signup(
    nome: str = Form(...),
    email: str = Form(...),
    senha: str = Form(...),
    confirmar_senha: str = Form(...),
    foto: UploadFile = File(None)
):
    if senha != confirmar_senha:
        raise HTTPException(status_code=400, detail="As senhas não conferem")

    usuarios = carregar_usuarios()
    if email in usuarios:
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")

    foto_path = None
    if foto:
        nome_arquivo = f"{email.replace('@', '_')}_{foto.filename}"
        foto_path = os.path.join(UPLOAD_DIR, nome_arquivo)
        with open(foto_path, "wb") as buffer:
            shutil.copyfileobj(foto.file, buffer)

    usuarios[email] = {
        "nome": nome,
        "email": email,
        "senha": pwd_context.hash(senha),
        "foto": foto_path,
        "verificado": False
    }
    salvar_usuarios(usuarios)
    print(f"LINK DE VERIFICAÇÃO: http://localhost:8001/auth/verify/{email}")
    return {"message": "Usuário criado! Verifique seu e-mail."}

@app.get("/auth/verify/{email}")
async def verificar_email(email: str):
    usuarios = carregar_usuarios()
    if email in usuarios:
        usuarios[email]["verificado"] = True
        salvar_usuarios(usuarios)
        return {"message": "Conta ativada!"}
    raise HTTPException(status_code=404)

@app.post("/login")
async def login(user: UserLogin):
    usuarios = carregar_usuarios()
    # Verifica se o usuário existe e a senha bate
    if user.email in usuarios:
        user_data = usuarios[user.email]
        if pwd_context.verify(user.password, user_data["senha"]):
            if not user_data["verificado"]:
                raise HTTPException(status_code=403, detail="E-mail não verificado!")
            
            token = jwt.encode({"sub": user.email, "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=12)}, SECRET_KEY, algorithm=ALGORITHM)
            return {"access_token": token, "token_type": "bearer", "user": user_data["nome"]}
            
    raise HTTPException(status_code=401, detail="Credenciais inválidas")

# 8. ROTAS DE NEGÓCIO (ESTOQUE)
@app.get("/estoque")
async def listar_estoque(user: str = Depends(get_current_user)):
    return carregar_estoque()

@app.post("/produto/entrada")
async def entrada_material(prod: Produto, user: str = Depends(get_current_user)):
    estoque = carregar_estoque()
    if prod.codigo in estoque:
        estoque[prod.codigo]["quantidade"] += prod.quantidade
    else:
        estoque[prod.codigo] = prod.dict()
    salvar_estoque(estoque)
    registrar_log("ENTRADA", prod.codigo, estoque[prod.codigo]["nome"], prod.quantidade, user)
    return {"status": "success"}

# ... (outras rotas: saída, alertas, buscar) permanecem iguais