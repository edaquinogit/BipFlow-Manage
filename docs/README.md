# Fluxo de Pedidos

1. Usuário cria pedido no **Vue.js Dashboard**.
2. Pedido é enviado para o **Backend Node.js**.
3. Node.js valida e persiste no banco SQLite.
4. **Python scripts** podem rodar auditoria ou validação extra.
5. **API Java** pode ser chamada para integração com ERP/logística.
6. Dashboard mostra status atualizado ao usuário.