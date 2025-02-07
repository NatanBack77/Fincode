#!/bin/sh

npm install @nestjs/cache-manager cache-manager

# Executa as migrations
npx prisma migrate deploy

# Inicia a aplicação
exec npm run start:prod
