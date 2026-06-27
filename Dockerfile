FROM node:20-slim
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Salin package.json root dan semua workspace untuk optimasi cache npm
COPY package*.json ./
COPY apps/bot/package*.json ./apps/bot/
COPY apps/web/package*.json ./apps/web/
COPY packages/db/package*.json ./packages/db/

# Install dependencies untuk seluruh monorepo
RUN npm install

# Salin seluruh source code proyek
COPY . .

# Generate Prisma Client untuk PostgreSQL
RUN npx prisma generate --schema=packages/db/prisma/schema.prisma

# Jalankan Bot Discord
CMD ["npm", "run", "start", "-w", "@cal-bot/bot"]
