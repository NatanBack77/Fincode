# Use uma imagem Node.js para construção
FROM node:lts-bullseye AS build

# Crie o diretório de trabalho na imagem
WORKDIR /app

# Copie os arquivos de configuração do projeto
COPY package.json package-lock.json tsconfig.build.json ./
COPY prisma ./prisma/
COPY . .

# Instale as dependências com npm
RUN npm install

RUN npx prisma generate

# Compile o código TypeScript
RUN npm run build && npm prune --production

# Fase de construção concluída
# Os artefatos de construção estão no diretório /app/dist

# Use uma imagem Node.js menor para a execução
FROM node:bullseye-slim 

# Crie o diretório de trabalho na imagem de execução
WORKDIR /app

# Copie os artefatos de construção da fase anterior
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/dist ./dist

# Copie apenas os arquivos necessários para a execução do aplicativo
COPY package*.json  ./

# Instale as dependências com npm apenas para a execução
RUN npm install --production

# Exponha a porta do aplicativo (substitua pela porta real do seu aplicativo, se necessário)
EXPOSE 3000

# Inicie o aplicativo
CMD [ "npm", "start" ]
