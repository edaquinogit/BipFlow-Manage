# Documentacao BipFlow

Esta pasta contem a documentacao viva do projeto. Ela deve ser curta, verificavel
no codigo e suficiente para operar o estado atual do repositorio.

## Documentos Mantidos

- [README principal](../README.md): visao geral, stack e setup rapido.
- [Entrega tecnica para avaliacao](technical-delivery.md): resumo profissional
  para tech lead, avaliador tecnico ou recrutador tecnico.
- [Arquitetura](architecture/system-overview.md): responsabilidades de cada
  aplicacao e limites entre Django e Vue.
- [Evolucao multi-loja](architecture/multi-tenant-evolution.md): estrategia para
  suportar varias lojas (multi-tenant) e roadmap por fases.
- [Guia de desenvolvimento](development-guide.md): ambiente local, comandos,
  qualidade e manutencao.
- [Go-live de producao](production-go-live.md): checklist executavel e smoke
  manual para receber pedidos reais.
- [Referencia da API Django](api/reference.md): endpoints implementados em
  `bipdelivery/api/`.
- [Bot do catalogo](features/catalog-bot.md): comportamento, contrato,
  responsabilidades e manutencao do bot publico guiado por regras.
- [README frontend](../bipflow-frontend/README.md): detalhes da aplicacao Vue.

## Codigo Arquivado

- `legacy/node-engine/`: motor Node/Express independente, arquivado na Fase 0 da
  evolucao multi-loja. Nao participa do runtime canonico. Ver `legacy/README.md`.

## Removidos Como Fonte De Verdade

- `docs/api/openapi.yaml`: era apenas placeholder sem paths reais.
- `CHANGELOG.md`: estava desatualizado e citava documentos que nao existem mais.
  O historico oficial deve ser consultado pelo Git.

## Ordem De Leitura

1. [README principal](../README.md)
2. [Entrega tecnica para avaliacao](technical-delivery.md)
3. [Arquitetura](architecture/system-overview.md)
4. [Guia de desenvolvimento](development-guide.md)
5. [Go-live de producao](production-go-live.md)
6. [Bot do catalogo](features/catalog-bot.md)
7. [Referencia da API Django](api/reference.md)

## Regra De Manutencao

Antes de alterar documentacao:

- confirme endpoints, comandos e arquivos no codigo;
- remova afirmacoes especulativas ou historicas que nao ajudam a operacao atual;
- prefira documentos pequenos e com responsabilidade clara;
- atualize a documentacao no mesmo ciclo da mudanca de codigo.
