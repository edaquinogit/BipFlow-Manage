# 02 - API SPECIFICATIONS

> The contract between Frontend and Backend — detailed endpoint documentation and response schemas

## Overview

This level provides **API contracts**, **response schemas**, **error handling**, and **content negotiation** details.

## Base Information

- **Base URL**: `http://localhost:8000/api/` (dev) | `https://api.bipflow.io/api/` (prod)
- **Port**: 8000 (Django development server)
- **API Version**: v1
- **Authentication**: JWT Bearer Token
- **Content-Type**: `application/json` (requests) | `application/json` or `multipart/form-data` (responses)

## Authentication Endpoints

### POST /auth/token/
**Issue JWT Token**

```json
Request:
POST /api/auth/token/
Content-Type: application/json

{
  "email": "admin@bipflow.io",
  "password": "secure_password"
}

Response: 200 OK
{
  "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}

Error: 400 Bad Request
{
  "detail": "Invalid credentials"
}
```

## Product Endpoints

### GET /v1/products/
**List all products with pagination**

```json
Query Parameters:
- page: int (default: 1)
- page_size: int (default: 10)
- category: int (filter by category_id)
- ordering: string (e.g., "-created_at" or "price")

Response: 200 OK
{
  "count": 42,
  "next": "http://localhost:8000/api/v1/products/?page=2",
  "previous": null,
  "results": [
    {
      "id": 1,
      "sku": "PROD-001",
      "name": "Widget Pro",
      "category": 5,
      "category_name": "Electronics",
      "description": "Professional-grade widget",
      "price": "99.99",
      "size": "M",
      "stock_quantity": 150,
      "is_available": true,
      "image": "https://api.bipflow.io/media/products/2026/01/widget-pro.jpg",
      "slug": "widget-pro-a1b2c3d4",
      "created_at": "2026-01-15T10:30:00Z",
      "updated_at": "2026-01-15T10:30:00Z"
    }
  ]
}

Error: 401 Unauthorized
{
  "detail": "Authentication credentials were not provided."
}
```

### POST /v1/products/
**Create a new product**

```json
Request:
POST /api/v1/products/
Content-Type: multipart/form-data
Authorization: Bearer {access_token}

{
  "sku": "PROD-002",
  "name": "Widget Plus",
  "category": 5,
  "description": "Enhanced widget variant",
  "price": "149.99",
  "size": "L",
  "stock_quantity": 50,
  "image": <binary_file>
}

Response: 201 Created
{
  "id": 2,
  "sku": "PROD-002",
  "name": "Widget Plus",
  ...
}

Error: 400 Bad Request
{
  "sku": ["unique - A product with this SKU already exists."],
  "name": ["This field may not be blank."]
}
```

### GET /v1/products/{id}/
**Retrieve single product**

```json
Response: 200 OK
{
  "id": 1,
  "sku": "PROD-001",
  ...
}

Error: 404 Not Found
{
  "detail": "Not found."
}
```

### PATCH /v1/products/{id}/
**Update product (partial or full)**

```json
Request:
PATCH /api/v1/products/1/
Content-Type: application/json
Authorization: Bearer {access_token}

{
  "stock_quantity": 120,
  "price": "89.99"
}

Response: 200 OK
{
  "id": 1,
  "sku": "PROD-001",
  "stock_quantity": 120,
  "price": "89.99",
  ...
}
```

### DELETE /v1/products/{id}/
**Delete product**

```json
Response: 204 No Content

Error: 404 Not Found
{
  "detail": "Not found."
}
```

## Category Endpoints

### GET /v1/categories/
**List all categories**

```json
Response: 200 OK
{
  "count": 8,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 1,
      "name": "Electronics",
      "slug": "electronics"
    },
    {
      "id": 2,
      "name": "Clothing",
      "slug": "clothing"
    }
  ]
}
```

### POST /v1/categories/
**Create category**

```json
Request:
{
  "name": "Office Supplies"
}

Response: 201 Created
{
  "id": 9,
  "name": "Office Supplies",
  "slug": "office-supplies"
}
```

## Documentation Endpoints

### GET /docs/
**Interactive Swagger UI**
- OpenAPI 3.0 schema
- Try-it-out feature for endpoints
- Real-time request/response examples

### GET /redoc/
**ReDoc Documentation**
- Beautiful HTML documentation
- Organized by tags and resources

## Error Handling

### Error Response Structure
```json
{
  "detail": "Human-readable error message",
  "code": "ERROR_CODE",
  "fields": {
    "field_name": ["Error message"]
  }
}
```

### Common HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | OK | GET product succeeded |
| 201 | Created | POST product succeeded |
| 204 | No Content | DELETE product succeeded |
| 400 | Bad Request | Invalid input data |
| 401 | Unauthorized | Missing/invalid JWT token |
| 403 | Forbidden | User lacks permission |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | SKU already exists |
| 500 | Server Error | Unhandled exception |

## Response Schemas (Zod Types)

### Product Schema
```typescript
interface Product {
  id: number;
  sku: string | null;
  name: string;
  category: number | Category;
  category_name: string;
  description?: string;
  price: string;       // Decimal as string from API
  size?: string | null;
  stock_quantity: number;
  is_available: boolean;
  image?: string | null;  // Absolute URL
  slug: string;
  created_at: string;  // ISO 8601
  updated_at: string;  // ISO 8601
}
```

### Category Schema
```typescript
interface Category {
  id: number;
  name: string;
  slug: string;
}
```

---

## Navigation

- **Previous**: [01-architecture/](../01-architecture/README.md) - System design
- **Next**: [03-frontend/](../03-frontend/README.md) - Frontend component rules
- **Interactive**: [/api/docs/](http://localhost:8000/api/docs/) - Live Swagger UI
