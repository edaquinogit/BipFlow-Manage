# BipFlow Integration Engine - Technical Documentation

## Overview
This module acts as a middleware for the Jitterbit Assessment, responsible for receiving order payloads from external sources and mapping them to the BipFlow internal schema.

## Key Features
- **Data Sanitization:** Implements logic to strip suffixes from `numeroPedido` (e.g., `v10089015vdb-01` becomes `v10089015vdb`).
- **Type Safety:** Ensures all incoming currency values are parsed as floats and quantities as integers.
- **Resilience:** Built-in fail-fast validation for mandatory fields.
- **Standardization:** All dates are normalized to ISO 8601 for database consistency.

## Tech Stack
- **Runtime:** Node.js v20+
- **Framework:** Express.js
- **Pattern:** Data Mapper

## Running the Engine
1. Install dependencies:

   ```bash
   npm install
