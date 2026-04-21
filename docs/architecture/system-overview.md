# Visao Geral Da Arquitetura

Resumo da arquitetura real mantida no repositorio, com foco no fluxo principal em producao do projeto.

## Contexto

O BipFlow hoje opera com duas aplicacoes centrais acopladas por HTTP:

- `bipdelivery`: backend Django REST
- `bipflow-frontend`: frontend Vue 3

Ha tambem um servico paralelo em `api-order-validation`, mas ele nao compoe o fluxo principal do catalogo e do dashboard web.

## Mapa De Componentes

```text
Usuario
  |
  | navega / interage
  v
Frontend Vue 3 (bipflow-frontend)
  |
  | HTTP JSON / multipart
  v
Backend Django REST (bipdelivery)
  |
  | ORM
  v
SQLite em desenvolvimento
```

Recursos complementares:

- JWT para autenticacao de escrita
- arquivos de imagem em `MEDIA_ROOT`
- checkout publico com geracao de mensagem para WhatsApp

## Responsabilidades Por Aplicacao

### Frontend Vue

Responsavel por:

- dashboard autenticado para gestao de produtos e categorias
- catalogo publico em `/produtos`
- filtros, busca, ordenacao e paginacao no catalogo
- carrinho local e coleta de dados do cliente
- chamada ao endpoint de checkout para montar a mensagem final do pedido

Estrutura funcional relevante:

- `src/services/`: integracao HTTP e regras de consumo da API
- `src/composables/`: estado reutilizavel de busca, carrinho e listagens
- `src/views/dashboard/`: area autenticada
- `src/views/products/`: experiencia publica de catalogo e checkout

### Backend Django

Responsavel por:

- CRUD de produtos
- CRUD de categorias
- autenticacao JWT
- regras de permissao publica para leitura e autenticada para escrita
- upload e serializacao de imagens
- validacao server-side do checkout via WhatsApp

Estrutura funcional relevante:

- `bipdelivery/api/models.py`
- `bipdelivery/api/serializers.py`
- `bipdelivery/api/views.py`
- `bipdelivery/api/pagination.py`
- `bipdelivery/core/settings.py`

## Contratos Principais

### Produtos

- Endpoint base: `/api/v1/products/`
- Leitura publica
- Escrita autenticada
- Resposta paginada
- `category` retorna id
- `category_name` retorna o nome denormalizado

### Categorias

- Endpoint base: `/api/v1/categories/`
- Leitura publica
- Escrita autenticada
- Exclusao protegida quando ha produtos relacionados

### Checkout

- Endpoint: `/api/v1/checkout/whatsapp/`
- Publico
- Recalcula totais no backend
- Gera mensagem e URL de redirecionamento para WhatsApp

## Decisoes Arquiteturais Importantes

- O frontend nao deve conhecer detalhes brutos do backend fora da camada de `services`.
- O backend centraliza validacoes criticas de estoque, disponibilidade e taxa de entrega.
- O catalogo publico e o dashboard compartilham a mesma API versionada.
- A documentacao deve priorizar o fluxo Django + Vue, porque este e o caminho implementado e testado no repositorio.

## Fora Do Escopo Deste Documento

Este documento nao descreve:

- arquitetura aspiracional futura
- integracoes que nao aparecem no codigo principal atual
- relatorios historicos de entrega ou auditoria mantidos na raiz
