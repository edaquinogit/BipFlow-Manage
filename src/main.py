def menu_principal():
    print("\n" + "="*30)
    print("      BIPFLOW MANAGER")
    print("="*30)
    print("1. Bipar Saída (Venda)")
    print("2. Consultar Estoque/Gaiola")
    print("0. Relatório de Reposição")

def main():
    while True:
        menu_principal()
        opcao = input("Escolha uma opção:")

        if opcao == "1":
            print("\n[Em desenvolvimento] Simulação de bipagem...")
        elif opcao == "2":
            print("\n[Em desenvolvinento] Consultando gaiolas...")
        elif opcao == "0":
            print("Encerramento BigFlow... Até logo!")
            break
        else:
            print("Opção inválida!")

    
if __name__ == "__main__":
    main()