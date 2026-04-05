# 00 - DISCOVERY & REQUIREMENTS

> The "Why" and "What" of BipFlow — requirements, business goals, and user stories

## Overview

This level defines the project's **strategic requirements**, **business goals**, and **user narratives** that drive development decisions.

## Contents

### Business Context

- **Project Vision**: BipFlow is a modern inventory management system combining Vue 3 frontend with Django REST API backend
- **Target User**: Small-to-medium enterprises requiring real-time product catalog management
- **Core Benefit**: Seamless product synchronization, category management, and stock tracking across channels

### Functional Requirements

#### User Stories

##### Story 1: Product Management

- **As a** Warehouse Manager
- **I want to** create, update, and delete products with images and stock info
- **So that** I can maintain an accurate inventory
- **Acceptance Criteria**:
  - Products support SKU, name, description, price, size, stock_quantity, and images
  - Automatic availability calculation (in-stock if quantity > 0)
  - Images are stored with automatic monthly organization
  - Category relationships protect data integrity (no orphaned categories)

##### Story 2: Category Organization

- **As a** Catalog Admin
- **I want to** organize products into categories with auto-generated URLs
- **So that** products can be classified and filtered
- **Acceptance Criteria**:
  - Categories have unique names and auto-slugified URLs
  - Category deletion is protected when products exist
  - Categories appear in dropdown menus for product forms

##### Story 3: Authentication & Access Control

- **As a** System Admin
- **I want to** ensure only authenticated users can access the API
- **So that** inventory data remains secure
- **Acceptance Criteria**:
  - JWT Bearer token authentication on all endpoints
  - Token refresh functionality for session management

### Non-Functional Requirements

| Requirement | Target | Rationale |
| --- | --- | --- |
| **Type Safety** | 100% TypeScript + Python type hints | Reduce runtime errors, improve IDE support |
| **Test Coverage** | 70% minimum | Ensure reliability for enterprise deployments |
| **API Documentation** | Auto-generated via drf-spectacular | Maintain up-to-date API contracts |
| **Performance** | <500ms response time (p95) | Acceptable for real-time inventory updates |
| **Availability** | 99.5% uptime (prod) | Standard SLA for business operations |
| **Security** | OWASP Top 10 compliance | Protect customer and business data |

### Constraints & Assumptions

- **Technology Stack**: Vue 3 + Django + PostgreSQL (production)
- **Deployment**: Docker-based containerization
- **Authentication**: JWT (no OAuth v2 complexity)
- **Images**: Max 2MB per upload, JPEG/PNG/WebP formats
- **Scale**: Up to 10,000 SKUs per instance

---

## Navigation

- **Next**: [01-architecture/](../01-architecture/README.md) - System design patterns and data flows
- **Related**: [02-api-specs/](../02-api-specs/) - API contracts and endpoint documentation
