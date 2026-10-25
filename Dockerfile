# ---- Build stage: compile TypeScript (needs the dev dependencies)
FROM node:20.19.4-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- Runtime stage: compiled output and production dependencies only
FROM node:20.19.4-slim

# Install MongoDB Database Tools (for mongodump, mongorestore, etc.)
RUN apt-get update && apt-get install -y wget gnupg \
    && wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | apt-key add - \
    && echo "deb [ arch=amd64 ] https://repo.mongodb.org/apt/debian bullseye/mongodb-org/6.0 main" \
        | tee /etc/apt/sources.list.d/mongodb-org-6.0.list \
    && apt-get update \
    && apt-get install -y mongodb-database-tools \
    && rm -rf /var/lib/apt/lists/*

# The code expects to live in /app (uploads are served from /app/src/uploads)
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

# Upload folders (multer does not create them) and the backup folder (the backup job needs it)
COPY src/uploads ./src/uploads
RUN mkdir -p backups

# Expose port (change if your app uses a different port)
EXPOSE 8080

# Start the app
CMD ["npm", "start"]
