FROM node:20-bookworm-slim
WORKDIR /home/nodejs/app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev
COPY . .
CMD ["sh","-lc","[ -d node_modules ] || npm ci --omit=dev || npm install --omit=dev; node server.js"]


#FROM node:latest

#WORKDIR /home/nodejs/app

#COPY . .

#RUN npm cache clean --force && npm install --verbose && npm install dotenv

#CMD ["npx", "nodemon", "server.js"]
