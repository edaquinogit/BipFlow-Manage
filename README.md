BipFlow Manage - Order Integration System 🚀

This repository contains the technical assessment for the Jitterbit Integration Challenge. It features a robust Node.js middleware designed to bridge external order payloads with the BipFlow internal schema.

🗽 Project Goal

To provide a scalable, type-safe, and resilient integration layer that sanitizes incoming data and ensures consistency across the BipFlow ecosystem.

🛠️ Key Technical Features

Data Transformation Layer: Custom mapper that handles ID sanitization (stripping suffixes like -01) and currency normalization.

RESTful Architecture: Express-based API following industry standards for status codes and error handling.

Environment Safety: Optimized .gitignore to ensure zero leakage of local configurations or dependencies.

Full-Stack Ready: Backend engine integrated with a Vue.js 3 frontend dashboard.

🚀 How to Run

Clone the repository.

Install dependencies: npm install

Start the engine: node index.js

Run tests: ./test-integration.sh

👨‍💻 Author

Ednaldo - Aspiring Integration Engineer focused on High-Performance Systems.