# Evolução Multi-Loja (Multi-Tenant)

Este documento descreve a estratégia para evoluir o BipFlow Manage de
**single-tenant** (uma loja por instância) para **multi-loja** (várias lojas
isoladas na mesma instância). Ele é a fonte de verdade do planejamento; o código
desta evolução deve ser implementado em fases, com a rede de segurança de testes
sempre verde.

> Status atual: **single-tenant**. Nenhuma tabela de negócio possui escopo de
> loja e `StoreSettings` é um singleton. Cada lojista exigiria, hoje, uma
> instância separada do sistema.

## 1. Diagnóstico do estado atual

O sistema assume um catálogo único e global. Pontos que impedem múltiplas lojas:

| Camada | Situação atual | Bloqueio |
| --- | --- | --- |
| `StoreSettings` | Singleton (`singleton_key=1`, `unique`) | Apenas 1 configuração de loja (WhatsApp único) por banco |
| `Product` / `Category` / `DeliveryRegion` | Sem coluna de escopo | Catálogo, frete e regiões são compartilhados globalmente |
| `SaleOrder` / `SaleOrderItem` | Sem coluna de escopo | Histórico de vendas é consolidado, sem separar por loja |
| Usuários / RBAC | Papéis `admin`/`manager`/`viewer` globais (grupos Django) | Um admin enxerga tudo; não existe "dono da loja X" |
| Checkout | `StoreSettings.get_configured_whatsapp_phone()` resolve 1 número | Pedido sempre vai para o mesmo WhatsApp |
| Frontend | URL sem escopo (`/produtos`, `/`), carrinho global em `localStorage` | Não há como saber qual loja o visitante está vendo |
| JWT | Token sem `store_id` | Backend não consegue filtrar dados pela loja do usuário |

Arquivos-âncora: `bipdelivery/api/models.py`, `bipdelivery/api/views.py`,
`bipdelivery/api/permissions.py`, `bipflow-frontend/src/services/api.ts`,
`bipflow-frontend/src/router/index.ts`.

## 2. Decisão arquitetural

Três estratégias possíveis:

| Estratégia | Como funciona | Veredito |
| --- | --- | --- |
| **Tenant por coluna (`store_id`)** | Uma tabela `Store`; tabelas de negócio ganham FK `store_id`; queries filtram por loja | **Recomendado** — simples, 1 banco, barato de operar |
| Schema por tenant | Cada loja em um schema isolado (PostgreSQL) | Só para SaaS grande; SQLite não suporta |
| Banco por tenant | Um banco por loja | Inviável de escalar/operar |

**Decisão:** multi-tenancy **por coluna (`store_id`)**.

**Pré-requisito técnico:** migrar **SQLite → PostgreSQL**. O checkout usa
`select_for_update()`; com várias lojas escrevendo simultaneamente, o lock
global do SQLite vira gargalo.

## 3. Modelo de dados alvo

Introduzir a entidade raiz `Store` e o vínculo usuário↔loja:

```python
class Store(models.Model):
    name           = CharField(max_length=120)
    slug           = SlugField(unique=True)          # loja na URL pública
    whatsapp_phone = CharField(max_length=32)        # absorve StoreSettings
    is_active      = BooleanField(default=True)
    owner          = ForeignKey(User, on_delete=PROTECT, related_name="owned_stores")
    created_at     = DateTimeField(auto_now_add=True)

class StoreMembership(models.Model):                 # substitui o RBAC global
    store = ForeignKey(Store, on_delete=CASCADE, related_name="memberships")
    user  = ForeignKey(User, on_delete=CASCADE, related_name="store_memberships")
    role  = CharField(choices=[("owner","owner"),("manager","manager"),("viewer","viewer")])

    class Meta:
        unique_together = ("store", "user")
```

Adicionar `store = ForeignKey(Store)` em: `Category`, `Product`,
`DeliveryRegion`, `SaleOrder` (`ProductGalleryImage` e `SaleOrderItem` herdam o
escopo pela FK do pai).

### Constraints a revisar (hoje são `unique` globais e quebrariam o multi-loja)

| Campo atual | Novo escopo |
| --- | --- |
| `Category.name` / `Category.slug` (unique) | `unique_together=("store", "slug")` |
| `Product.sku` (unique) | `unique_together=("store", "sku")` |
| `Product.slug` | único por loja |
| `DeliveryRegion.name` (unique) | `unique_together=("store", "name")` |
| `StoreSettings` (singleton) | **descontinuado** — absorvido por `Store` |

## 4. Plano de evolução por fases

### Fase 0 — Saneamento e rede de segurança ✅ (este passo)

- Consolidar o Django como backend canônico.
- Arquivar o motor Node legado em `legacy/node-engine/`.
- Atualizar README e `docs/architecture/system-overview.md` para a arquitetura real.
- Garantir testes do fluxo atual verdes antes de qualquer mudança estrutural
  (97 testes pytest) e adicionar CI (`.github/workflows/ci.yml`) como rede de
  segurança durável.
- **Não** implementar `Store`, `StoreMembership` nem migrations multi-tenant
  ainda.

### Fase 1 — Fundação de dados (backend)

- Criar `Store` e `StoreMembership`.
- **Data migration**: criar uma "loja default", apontar todos os registros
  existentes para ela e migrar `StoreSettings.whatsapp_phone` →
  `Store.whatsapp_phone`. Sem perda de dados.
- Adicionar `store_id` nas tabelas de negócio (nullable → backfill → not null).
- Trocar as constraints `unique` globais por `unique_together` com `store`.
- (Pré-requisito) migrar para PostgreSQL.

### Fase 2 — Isolamento na API (ponto mais sensível)

- Resolver a loja por request:
  - **Público/catálogo:** por `slug` na URL (ex.: `/api/v1/<store_slug>/...`)
    ou header `X-Store-Slug`.
  - **Dashboard/autenticado:** `store_id` como claim no JWT + `StoreMembership`.
- Criar um **queryset/mixin base** que aplica `.filter(store=request.store)`
  automaticamente em **todas** as viewsets — não depender de lembrar em cada
  endpoint (principal fonte de vazamento entre tenants).
- Reescrever `CheckoutWhatsAppView`: WhatsApp via `request.store.whatsapp_phone`
  (não mais o singleton) e validar que todos os `product_id` do carrinho
  pertencem à loja do checkout.
- Atualizar `permissions.py`: papéis passam a ser **por loja** (via
  `StoreMembership`), não mais globais.

### Fase 3 — Frontend (Vue)

- Escopo de loja na rota pública: `/l/:storeSlug/produtos`, `/l/:storeSlug/produtos/:slug`.
- Carrinho em `localStorage` por loja: `bipflow_cart_<storeSlug>` (hoje é global
  e colidiria entre lojas).
- Dashboard: ler a(s) loja(s) do usuário do `CurrentUser`/JWT; se houver mais de
  uma, adicionar um **seletor de loja** (store switcher).
- `api.ts`: injetar o escopo da loja (slug na URL ou header) nas chamadas.
- Tela de configurações passa a editar dados da **loja atual** (nome, slug, WhatsApp).

### Fase 4 — Onboarding e operação

- Fluxo de cadastro de loja (cria `Store` + `StoreMembership` owner no registro).
- Convite de membros para uma loja.
- Upload de imagens isolado por loja (`products/<store_id>/%Y/%m/`).
- Django admin filtrando por loja.

## 5. Riscos e pontos de atenção

1. **Vazamento entre tenants** — risco nº 1. Qualquer query sem `store_id` expõe
   dados de outra loja. Mitigação: queryset base obrigatório + testes de
   isolamento ("usuário da loja A não acessa pedido da loja B").
2. **Constraints `unique` globais** — a migração falha se houver SKUs/slugs
   duplicados ao consolidar. Tratar no backfill.
3. **SQLite + concorrência** — lock global no checkout; daí o pré-requisito do
   PostgreSQL.
4. **Throttling de checkout** — hoje por IP/telefone global; revisar se deve ser
   por loja.
5. **Mídia/imagens** — isolar paths e considerar storage externo (ex.: S3)
   quando crescer.

## 6. Esforço estimado (ordem de grandeza)

| Fase | Complexidade | Esforço aprox. |
| --- | --- | --- |
| 0 — Saneamento + CI | Média | 2–4 dias |
| 1 — `Store` + migrations + PostgreSQL | Média | 3–5 dias |
| 2 — Isolamento na API + JWT | **Alta** | 5–8 dias |
| 3 — Frontend com escopo | Média-alta | 4–6 dias |
| 4 — Onboarding/membros | Média | 3–5 dias |

## 7. Definição de pronto da Fase 0

- [x] Backend canônico = Django; motor Node arquivado em `legacy/`.
- [x] README e visão geral refletem a arquitetura real.
- [x] Este documento criado.
- [x] Testes do fluxo atual verdes (pytest) e CI configurado como rede de
      segurança.
- [ ] (Próxima fase) `Store` / `StoreMembership` — **não** implementados nesta etapa.
