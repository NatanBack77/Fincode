# Etapa de build
FROM node:20-alpine AS build

# Diretório de trabalho
WORKDIR /app

# Copia apenas arquivos essenciais para instalar as dependências
COPY package.json package-lock.json tsconfig.build.json ./
COPY prisma ./prisma/

# Instala apenas as dependências necessárias para produção
RUN npm ci

# Copia o restante do código
COPY . .

# Gera os arquivos do Prisma
RUN npx prisma generate

# Compila o código TypeScript
RUN npm run build

# Remover dependências de desenvolvimento
RUN npm prune --production

# Etapa de execução
FROM node:20-alpine AS runtime

USER node

# Diretório de trabalho
WORKDIR /app

# Instala pacotes necessários (caso precise do OpenSSL)
RUN apk add --no-cache openssl

# Copia os arquivos da fase de build
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json /app/package-lock.json ./

# Instala apenas as dependências necessárias para produção
RUN npm ci --only=production

# Copia o script de inicialização
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expor a porta do aplicativo
EXPOSE 3000

# Usa o script como ponto de entrada
ENTRYPOINT ["/entrypoint.sh"]
