import json
import sys
import os

if sys.platform == "win32":
    os.system('chcp 65001 > nul')

def carregar_estoque():
    try:
        with open("data/estoque.json", "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {}

def salvar_estoque(estoque):
    with open("data/estoque.json", "w", encoding="utf-8") as f:
        json.dump(estoque, f, indent=4, ensure_ascii=False)

def registrar_saida(codigo_barras):
    estoque = carregar_estoque()

    if codigo_barras in estoque:
        produto = estoque[codigo_barras]

        if produto["quantidade"] > 0:
            produto["quantidade"] -= 1
            # AQUI SALVAMOS A ALTERAÇÃO:
            salvar_estoque(estoque)
            
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
        # --- VERSÃO PREMIUM: Identifica o produto visualmente antes de pedir a quantidade ---
        produto = estoque[codigo]
        print(f"\n📦 PRODUTO IDENTIFICADO: {produto['nome']}")
        print(f"🎨 ESTAMPA: {produto['estampa']} | TAMANHO: {produto['tamanho']}")
        
        try:
            qtd_nova = int(input(f"Quanto(s) do código '{codigo}' chegaram? "))
            estoque[codigo]["quantidade"] += qtd_nova
            salvar_estoque(estoque)
            print(f"\n✅ ESTOQUE ATUALIZADO: Agora temos {estoque[codigo]['quantidade']} unidades.")
        except ValueError:
            print("\n❌ ERRO: Digite apenas números para a quantidade!")
            
    else:
        print("\n⚠️ PRODUTO NOVO DETECTADO! Vamos cadastrar:")
        nome = input("Nome do produto: ")
        tamanho = input("Tamanho (King/Queen/Casal/Solteiro): ")
        estampa = input("Nome da Estampa/Cor: ")
        try:
            qtd = int(input("Quantidade recebida: "))
            minimo = int(input("Alerta de estoque mínimo em quanto? "))
            gaiola = input("Em qual gaiola vai guardar? ").upper()
            preco = float(input("Preço de venda: R$ ").replace(',', '.'))

            estoque[codigo] = {
                "nome": nome,
                "tamanho": tamanho,
                "estampa": estampa,
                "quantidade": qtd,
                "estoque_minimo": minimo,
                "gaiola": gaiola,
                "preco": preco
            }
            salvar_estoque(estoque)
            print(f"\n🎉 Sucesso! '{nome}' cadastrado e disponível para venda.")
        except ValueError:
            print("\n❌ ERRO: Preço e Quantidade devem ser números!")

def menu_principal():
    print("\n--- BIPFLOW MANAGER v1.1 ---")
    print("1. Registrar Saída (Bipar)")
    print("2. Registrar Entrada (Fábrica)") 
    print("3. Consultar Gaiola")
    print("4. Relatório para Fábrica")
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