FROM node:18-alpine

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances
RUN npm ci --only=production

# Copier le code source
COPY . .

# Générer Prisma client
RUN npx prisma generate

# Build de l'application
RUN npm run build

# Exposer le port
EXPOSE 3000

# Variables d'environnement par défaut
ENV NODE_ENV=production
ENV PORT=3000

# Démarrer l'application
CMD ["npm", "start"]