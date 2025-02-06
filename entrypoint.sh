#!/bin/sh

# Executa as migrations
npx prisma migrate deploy

# Inicia a aplicação
exec npm run start:prod
