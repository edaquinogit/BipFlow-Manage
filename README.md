# BipDelivery - Fast Order Management System 🗽🍔

![Python](https://img.shields.io/badge/python-3670A0?style=for-the-badge&logo=python&logoColor=ffdd54)
![Django](https://img.shields.io/badge/django-%23092e20.svg?style=for-the-badge&logo=django&logoColor=white)
![DjangoREST](https://img.shields.io/badge/DJANGO-REST-ff1709?style=for-the-badge&logo=django&logoColor=white)
![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E)

BipDelivery é um ecossistema de gerenciamento de pedidos em tempo real, desenvolvido para otimizar a conexão entre estabelecimentos locais e clientes finais. O projeto foca em alta performance, escalabilidade e uma experiência de usuário fluida.

## 🚀 Status do Projeto: Em Desenvolvimento (Sprint 2 - Frontend Integration)

Atualmente, o sistema possui um Core Backend robusto com API REST funcional e está em fase de integração com a camada de visualização (Frontend).

## 🛠️ Tecnologias & Arquitetura

O projeto segue o padrão de **Separação de Preocupações (SoC)**:

- **Backend:** Django 5.x & Django REST Framework (DRF)
- **Database:** SQLite (Desenvolvimento) / PostgreSQL Ready
- **Frontend:** Vanilla Architecture (HTML5, CSS3 Moderno, JavaScript ES6+)
- **Media Handling:** Processamento e entrega de imagens via Django Storage

## 📂 Estrutura do Repositório

```text
├── bipdelivery/         # Core do projeto Django
├── api/                 # App de abstração da API e Modelos
├── frontend/            # Interface do usuário (Client-side)
├── media/               # Armazenamento de assets de produtos
└── manage.py            # CLI do Django

⚙️ Como rodar o projeto localmente

1. Clonar o repositório

git clone [https://github.com/seu-usuario/BipFlow-Manage.git](https://github.com/seu-usuario/BipFlow-Manage.git)
cd BipFlow-Manage

2. Configurar o Ambiente Virtual

python -m venv venv
source venv/bin/activate  # No Windows: venv\Scripts\activate
pip install -r requirements.txt

3. Executar as Migrações e Servidor

python manage.py migrate
python manage.py runserver
A API estará disponível em http://127.0.0.1:8000/api/v1/products/

🛣️ Roadmap de Desenvolvimento

[x] Definição da Arquitetura de Banco de Dados

[x] Implementação de API REST para Produtos

[x] Sistema de Upload de Imagens dinâmico

[ ] Implementação de Segurança CORS (Próximo Passo)

[ ] Desenvolvimento da Vitrine de Produtos (Frontend)

[ ] Integração com Gateway de Pagamento

Desenvolvido por Ednaldo – Focado em soluções escaláveis e pronto para o mercado global. 🚀