FROM node:20-slim AS base

# Definir diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências
COPY package.json package-lock.json ./

# Instalar dependências
RUN npm install

# Copiar o restante do código
COPY . .

# Construir a aplicação
RUN npm run build && ls dist

# -----------------------------
# Etapa de Produção
# -----------------------------
FROM node:20-slim AS production

# Definir diretório de trabalho
WORKDIR /app

# Copiar somente os arquivos necessários
COPY --from=base /app/dist ./dist
COPY --from=base /app/package.json ./package.json
COPY --from=base /app/node_modules ./node_modules

# Remover dependências de desenvolvimento
RUN npm prune --production

# Expor a porta
EXPOSE 3000

# Comando de inicialização
CMD ["node", "dist/main.js"]
