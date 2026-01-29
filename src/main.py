import json
import sys
import os
import datetime

# Aqui está certo! Os dois pontos mandam ele sair da 'src' e ir para a raiz
CAMINHO_ESTOQUE = "../data/estoque.json"
CAMINHO_LOG = "../data/historico_vendas.csv"

# Ajuste de codificação para Windows
if sys.platform == "win32":
    os.system('chcp 65001 > nul')

def carregar_estoque():
    try:
        # 1. Primeiro, garantimos que a pasta existe no lugar certo (na raiz)
        pasta_data = "../data"
        if not os.path.exists(pasta_data): 
            os.makedirs(pasta_data)
        
        # 2. AQUI ESTAVA O ERRO: Use a variável CAMINHO_ESTOQUE em vez de escrever o texto
        with open(CAMINHO_ESTOQUE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}

def registrar_saida(codigo):
    # Lembre-se de fazer o mesmo na função de salvar!
    estoque = carregar_estoque()
    if codigo in estoque:
        # Lógica de salvar no log usando CAMINHO_LOG...
        pass

def salvar_estoque(estoque):
    if not os.path.exists("data"): os.makedirs("data")
    with open("data/estoque.json", "w", encoding="utf-8") as f:
        json.dump(estoque, f, indent=4, ensure_ascii=False)

def registrar_movimentacao_log(acao, codigo, nome, quantidade):
    data_hora = datetime.datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    arquivo_log = "data/historico_vendas.csv"
    
    if not os.path.exists("data"): os.makedirs("data")
    
    existe = os.path.exists(arquivo_log)
    
    with open(arquivo_log, "a", encoding="utf-8") as f:
        if not existe:
            f.write("Data/Hora;Ação;Código;Produto;Quantidade\n")
        f.write(f"{data_hora};{acao};{codigo};{nome};{quantidade}\n")

def registrar_saida(codigo_barras):
    estoque = carregar_estoque()

    if codigo_barras in estoque:
        produto = estoque[codigo_barras]

        if produto["quantidade"] > 0:
            produto["quantidade"] -= 1
            salvar_estoque(estoque)
            
            # REGISTRO DE LOG (Auditoria)
            registrar_movimentacao_log("SAÍDA", codigo_barras, produto['nome'], 1)
            
            print(f"\n✅ Saída confirmada: {produto['nome']} ({produto['estampa']})")
            print(f"📍 Localização: GAIOLA {produto['gaiola']}")
            print(f"📦 Restam: {produto['quantidade']} unidades.")

            if produto["quantidade"] <= produto["estoque_minimo"]:
                print(f"⚠️  ALERTA: Estoque baixo! Considere repor.")
        else:
            print("\n❌ ERRO: Estoque zerado no sistema! Verificar urgência com a fábrica.")
    else:
        print("\n🚫 Código não encontrado. Cadastrar nova variação?")

def consultar_gaiola(numero_gaiola):
    estoque = carregar_estoque()
    encontrados = []

    print(f"\n--- 🔍 CONTEÚDO DA GAIOLA: {numero_gaiola} ---")

    for codigo, info in estoque.items():
        if info["gaiola"].upper() == numero_gaiola.upper():
            encontrados.append(info)
            status = "✅ OK" if info["quantidade"] > info["estoque_minimo"] else "⚠️  BAIXO"
            print(f"- {info['nome']} | {info['estampa']} | Qtd: {info['quantidade']} [{status}]")

    if not encontrados:
        print("❌ Nenhuma variação encontrada para esta gaiola.")
    print("-" * 35)

def gerar_relatorio_fabrica():
    estoque = carregar_estoque()
    precisa_repor = False

    print("\n" + "!"*40)
    print("📋 RELATÓRIO DE REPOSIÇÃO PARA A FÁBRICA")
    
    for codigo, info in estoque.items():
        if info["quantidade"] <= info["estoque_minimo"]:
            precisa_repor = True
            necessidade = info["estoque_minimo"] - info["quantidade"] + 5
            print(f"🔹 {info['nome']} | {info['estampa']} ({info['tamanho']})")
            print(f"   Status: {info['quantidade']} em estoque (Mínimo: {info['estoque_minimo']})")
            print(f"   SUGESTÃO DE PEDIDO: +{necessidade} unidades\n")

    if not precisa_repor:
        print("✅ Tudo em dia! Nenhuma reposição urgente necessária.")
    print("!"*40)

def registrar_entrada():
    estoque = carregar_estoque()
    codigo = input("Bipe o código do produto que chegou: ")

    if codigo in estoque:
        produto = estoque[codigo]
        print(f"\n📦 PRODUTO IDENTIFICADO: {produto['nome']}")
        print(f"🎨 ESTAMPA: {produto['estampa']} | TAMANHO: {produto['tamanho']}")
        
        try:
            qtd_nova = int(input(f"Quanto(s) do código '{codigo}' chegaram? "))
            estoque[codigo]["quantidade"] += qtd_nova
            salvar_estoque(estoque)
            
            # REGISTRO DE LOG
            registrar_movimentacao_log("ENTRADA", codigo, produto['nome'], qtd_nova)
            
            print(f"\n✅ ESTOQUE ATUALIZADO: Agora temos {estoque[codigo]['quantidade']} unidades.")
        except ValueError:
            print("\n❌ ERRO: Digite apenas números para a quantidade!")
            
    else:
        print("\n⚠️ PRODUTO NOVO DETECTADO! Vamos cadastrar:")
        try:
            nome = input("Nome do produto: ")
            tamanho = input("Tamanho: ")
            estampa = input("Estampa/Cor: ")
            qtd = int(input("Quantidade inicial: "))
            minimo = int(input("Estoque mínimo: "))
            gaiola = input("Gaiola: ").upper()
            preco_v = float(input("Preço de venda: ").replace(',', '.'))
            preco_c = float(input("Preço de custo (fábrica): ").replace(',', '.'))

            estoque[codigo] = {
                "nome": nome,
                "tamanho": tamanho,
                "estampa": estampa,
                "quantidade": qtd,
                "estoque_minimo": minimo,
                "gaiola": gaiola,
                "preco": preco_v,
                "custo": preco_c
            }
            salvar_estoque(estoque)
            registrar_movimentacao_log("CADASTRO NOVO", codigo, nome, qtd)
            print(f"\n🎉 Sucesso! '{nome}' cadastrado.")
        except ValueError:
            print("\n❌ ERRO: Verifique os valores numéricos digitados!")

def menu_principal():
    print("\n--- BIPFLOW MANAGER v1.1 ---")
    print("1. Registrar Saída (Bipar)")
    print("2. Registrar Entrada") 
    print("3. Consultar Estoque")
    print("4. Relatório de Estoque")
    print("0. Sair")

def main():
    while True:
        menu_principal()
        opcao = input("Escolha uma opção: ")

        if opcao == "1":
            codigo = input("Bipe o código de barras: ")
            registrar_saida(codigo)
        elif opcao == "2":
            registrar_entrada()
        elif opcao == "3":
            gaiola = input("Digite o número da gaiola: ")
            consultar_gaiola(gaiola)
        elif opcao == "4":
            gerar_relatorio_fabrica()
        elif opcao == "0":
            print("Encerrando...")
            break

if __name__ == "__main__":
    main()