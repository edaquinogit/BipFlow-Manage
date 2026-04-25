# Documentacao BipFlow

Esta pasta concentra a documentacao viva do projeto. O objetivo e manter poucos arquivos, com responsabilidade clara e alinhados ao codigo.

## Documentos Oficiais

- [README principal](../README.md): visao geral, setup rapido e convencoes do repositorio.
- [system-overview.md](architecture/system-overview.md): arquitetura real do fluxo Django + Vue.
- [development-guide.md](development-guide.md): setup local, qualidade, seguranca backend e manutencao.
- [reference.md](api/reference.md): contrato funcional da API Django.
- [README frontend](../bipflow-frontend/README.md): stack, scripts e convencoes do Vue.

## Ordem De Leitura Recomendada

1. [system-overview.md](architecture/system-overview.md)
2. [development-guide.md](development-guide.md)
3. [reference.md](api/reference.md)

## Escopo

- `architecture/`: visao de alto nivel do sistema e das responsabilidades de cada aplicacao.
- `api/`: contrato funcional dos endpoints mantidos pelo backend Django.
- `development-guide.md`: setup, fluxo local, qualidade e praticas de manutencao.

## Regra De Manutencao

Antes de atualizar a documentacao:

- confirme o comportamento no codigo antes de escrever
- prefira citar arquivos, endpoints e comandos reais
- evite descrever componentes que nao participam do fluxo principal atual
- nao recrie relatorios de entrega, auditoria ou "summary" como fonte de verdade paralela

Se um documento desta pasta divergir do codigo, o correto e ajustar o documento imediatamente ou remover a afirmacao duvidosa.
