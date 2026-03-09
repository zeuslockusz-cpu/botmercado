# Usa a imagem oficial do Node leve
FROM node:18-bullseye-slim

# Instala o Chromium e dependências para o Puppeteer
RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Informa ao Puppeteer onde o Chrome está instalado
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Configura o app
WORKDIR /usr/src/app

# Copia pacotes e instala
COPY package*.json ./
RUN npm install

# Copia o código
COPY . .

# Comando de início do bot
CMD ["npm", "start"]
