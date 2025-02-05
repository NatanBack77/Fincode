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

# Gere os arquivos do Prisma
RUN npx prisma generate

# Compile o código TypeScript
RUN npm run build

# Remova dependências de desenvolvimento
RUN npm prune --production

# Fase de construção concluída
# Os artefatos de construção estão no diretório /app/dist

# Use uma imagem Node.js menor para a execução
FROM node:bullseye-slim 

# Crie o diretório de trabalho na imagem de execução
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl

# Copie os artefatos de construção da fase anterior
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/dist ./dist

# Copie apenas os arquivos necessários para a execução do aplicativo
COPY package.json package-lock.json ./

# Instale as dependências com npm
RUN npm install --omit=dev

# Rode as migrações do Prisma
RUN npx prisma migrate deploy

# Crie o usuário Natan e configure permissões
RUN useradd -m Natan && chown -R Natan /app

# Troque para o usuário Natan
USER Natan

# Exponha a porta do aplicativo (substitua pela porta real do seu aplicativo, se necessário)
EXPOSE 3000

# Inicie o aplicativo
CMD ["npm", "run", "start:prod"]
