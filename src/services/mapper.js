// --- src/services/mapper.js ---
// O Mapper é crucial para transformar dados da DB em objetos de domínio (Domain Objects)
// Isso evita que seu front-end fique acoplado à estrutura da sua tabela SQL.
export class DataMapper {
  static toDomain(raw) {
    return {
      id: raw.id,
      flowName: raw.flow_name, // Exemplo de conversão de snake_case para camelCase
      createdAt: new Date(raw.created_at),
    };
  }

  static toPersistence(domain) {
    return {
      flow_name: domain.flowName,
    };
  }
}
