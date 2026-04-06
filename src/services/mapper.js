// --- src/services/mapper.js ---
// The Mapper is crucial for transforming database data into domain objects
// This prevents your frontend from being tightly coupled to your SQL table structure.
export class DataMapper {
  static toDomain(raw) {
    return {
      id: raw.id,
      flowName: raw.flow_name, // Example of snake_case to camelCase conversion
      createdAt: new Date(raw.created_at),
    };
  }

  static toPersistence(domain) {
    return {
      flow_name: domain.flowName,
    };
  }
}
