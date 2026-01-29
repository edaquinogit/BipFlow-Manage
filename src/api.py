from fastapi import FastAPI, HTTPException
from main import carregar_estoque, registrar_saida
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="BipFlow API 2026")

# Isso é vital para que seu Front-end consiga conversar com a API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Permite que qualquer front-end acesse
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {"status": "Online", "projeto": "BipFlow"}

@app.get("/produto/{codigo}")
def buscar_produto(codigo: str):
    estoque = carregar_estoque()
    if codigo in estoque:
        return {"codigo": codigo, **estoque[codigo]}
    raise HTTPException(status_code=404, detail="Produto não encontrado")

@app.post("/saida/{codigo}")
def confirmar_saida(codigo: str):
    # Usando a lógica que você já validou no main.py
    sucesso = registrar_saida(codigo)
    if sucesso:
        return {"status": "sucesso", "codigo": codigo}
    raise HTTPException(status_code=400, detail="Erro ao registrar saída")

if __name__ == "__main__":
    import uvicorn
    # O segredo é o uvicorn rodar aqui para segurar o processo aberto
    uvicorn.run("api:app", host="127.0.0.1", port=8000, reload=True)