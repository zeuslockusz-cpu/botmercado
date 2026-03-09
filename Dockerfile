# Usa uma imagem oficial do Puppeteer que já traz o Chrome e as dependências Linux pesadas
FROM ghcr.io/puppeteer/puppeteer:latest

# Define que o Puppeteer usará o Chrome do próprio container
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Define a pasta onde o app vai ficar no container
WORKDIR /usr/src/app

# Copia os arquivos de dependência 
# (precisa ser root momentaneamente para o npm install caso haja problema de permissão)
USER root
COPY package*.json ./

# Instala os pacotes
RUN npm install

# Copia o resto do código
COPY . .

# Comando para iniciar o bot
CMD [ "npm", "start" ]
