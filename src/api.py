from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from main import carregar_estoque, registrar_saida, registrar_entrada

app = FastAPI(title="BipFlow API Elite")

# Configuração de CORS para permitir a comunicação com o Front-end
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {"status": "Online", "sistema": "BipFlow Industrial"}

@app.get("/produto/{codigo}")
def buscar_produto(codigo: str):
    estoque = carregar_estoque()
    if codigo in estoque:
        return {"codigo": codigo, **estoque[codigo]}
    raise HTTPException(status_code=404, detail="Produto não identificado")

@app.post("/saida/{codigo}")
def confirmar_saida(codigo: str, qtd: int = 1):
    from main import registrar_saida
    # Agora recebemos dois valores: o status (sucesso) e os dados do produto
    sucesso, produto = registrar_saida(codigo, qtd)
    if sucesso:
        return {"status": "sucesso", "produto": produto}
    raise HTTPException(status_code=400, detail="Estoque insuficiente ou código inválido")

@app.post("/entrada/{codigo}")
def confirmar_entrada(codigo: str, qtd: int = 1):
    from main import registrar_entrada
    sucesso, produto = registrar_entrada(codigo, qtd)
    if sucesso:
        return {"status": "sucesso", "produto": produto}
    raise HTTPException(status_code=400, detail="Erro ao registrar entrada")

@app.post("/cadastrar")
def cadastrar_novo(dados: dict):
    from main import registrar_entrada
    # Extraímos o código e os detalhes
    codigo = dados.get("codigo")
    if not codigo:
        raise HTTPException(status_code=400, detail="Código inválido")
    
    # Chamamos a função do main passando os dados para criação
    sucesso, produto = registrar_entrada(codigo, qtd=dados['quantidade'], dados_novo=dados)
    
    if sucesso:
        return {"status": "cadastrado", "produto": produto}
    raise HTTPException(status_code=400, detail="Erro ao cadastrar")

@app.get("/estoque")
def consultar_estoque_geral():
    return carregar_estoque()

@app.get("/relatorio")
def gerar_relatorio():
    estoque = carregar_estoque()
    # Formata os dados de forma limpa para gráficos
    return [{"produto": v['nome'], "qtd": v['quantidade']} for k, v in estoque.items()]

if __name__ == "__main__":
    import uvicorn
    # Host 0.0.0.0 permite que outros PCs na mesma rede acessem sua API (muito útil!)
    uvicorn.run("api:app", host="127.0.0.1", port=8000, reload=True)