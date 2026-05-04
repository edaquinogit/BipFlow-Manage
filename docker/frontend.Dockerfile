FROM node:20-slim AS build

WORKDIR /app

COPY bipflow-frontend/package*.json ./
RUN npm ci

ARG VITE_API_URL=/api/
ENV VITE_API_URL=${VITE_API_URL}

COPY bipflow-frontend ./
RUN npm run build

FROM nginx:1.27-alpine

RUN mkdir -p /etc/nginx/snippets
COPY docker/nginx-proxy-headers.conf /etc/nginx/snippets/proxy-headers.conf
COPY docker/frontend-nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
