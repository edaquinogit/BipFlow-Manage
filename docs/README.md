# Documentacao BipFlow

Esta pasta contem a documentacao viva do projeto. Ela deve ser curta, verificavel
no codigo e suficiente para operar o estado atual do repositorio.

## Documentos Mantidos

- [README principal](../README.md): visao geral, stack e setup rapido.
- [Arquitetura](architecture/system-overview.md): responsabilidades de cada
  aplicacao e limites entre Django, Vue e motor Node.
- [Guia de desenvolvimento](development-guide.md): ambiente local, comandos,
  qualidade e manutencao.
- [Referencia da API Django](api/reference.md): endpoints implementados em
  `bipdelivery/api/`.
- [README frontend](../bipflow-frontend/README.md): detalhes da aplicacao Vue.

## Arquivos De Apoio

- `docs/swagger.js` e usado pelo motor Node da raiz para servir `/api-docs`.
  Ele nao e a referencia da API Django.

## Removidos Como Fonte De Verdade

- `docs/api/openapi.yaml`: era apenas placeholder sem paths reais.
- `CHANGELOG.md`: estava desatualizado e citava documentos que nao existem mais.
  O historico oficial deve ser consultado pelo Git.

## Ordem De Leitura

1. [README principal](../README.md)
2. [Arquitetura](architecture/system-overview.md)
3. [Guia de desenvolvimento](development-guide.md)
4. [Referencia da API Django](api/reference.md)

## Regra De Manutencao

Antes de alterar documentacao:

- confirme endpoints, comandos e arquivos no codigo;
- remova afirmacoes especulativas ou historicas que nao ajudam a operacao atual;
- prefira documentos pequenos e com responsabilidade clara;
- atualize a documentacao no mesmo ciclo da mudanca de codigo.
