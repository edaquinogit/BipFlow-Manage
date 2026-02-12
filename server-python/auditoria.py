import os

def auditoria_estoque():
    # Caminho do arquivo que o app gera
    arquivo_app = "leitura_teste.txt"
    
    print("\n" + "="*30)
    print("🚀 BIPFLOW - MÓDULO AUDITORIA")
    print("="*30)

    # 1. Verifica se o arquivo existe
    if not os.path.exists(arquivo_app):
        print(f"❌ ERRO: O arquivo '{arquivo_app}' não foi encontrado na pasta.")
        return

    # 2. Lê os pedidos bipados no App
    with open(arquivo_app, "r") as f:
        # strip() remove espaços, if linha garante que não pegue linha vazia
        lista_bipados = [linha.strip() for linha in f if linha.strip()]

    # 3. Simula a lista que vem do UpSeller (O que DEVERIA ter sido enviado)
    # Amanhã vamos aprender a carregar isso de um arquivo real
    lista_upseller = ["PEDIDO_1001", "PEDIDO_1002", "PEDIDO_1003", "PEDIDO_1004", "PEDIDO_1005"]

    # 4. A Mágica: Comparação usando Conjuntos (Sets)
    set_bipados = set(lista_bipados)
    set_upseller = set(lista_upseller)

    faltantes = set_upseller - set_bipados
    sobrando = set_bipados - set_upseller

    # 5. Resultado para o Usuário
    print(f"📊 Resumo: {len(lista_bipados)} lidos | {len(lista_upseller)} esperados.")
    print("-" * 30)

    if not faltantes and not sobrando:
        print("✅ SUCESSO: Tudo conferido! Pode carregar o caminhão.")
    else:
        if faltantes:
            print(f"🚨 ATENÇÃO! Pedidos NÃO BIPADOS: {faltantes}")
        if sobrando:
            print(f"⚠️ CUIDADO! Pedidos bipados que NÃO estão na lista: {sobrando}")
    print("="*30 + "\n")

if __name__ == "__main__":
    auditoria_estoque()