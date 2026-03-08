FROM node:20-slim
WORKDIR /usr/src/app
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm install
COPY . .
RUN mkdir -p database
RUN node database/setup.js
EXPOSE 3000
CMD [ "node", "index.js" ]
