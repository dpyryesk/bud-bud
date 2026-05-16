FROM node:22-alpine
WORKDIR /app

# Install pnpm (version matches packageManager in package.json)
RUN npm install -g pnpm@10.33.3

# Install dependencies first for better layer caching
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the app (runs prisma generate + next build)
RUN pnpm build

# Create the data directory used for the SQLite volume
RUN mkdir -p data

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

ENTRYPOINT ["sh", "docker-entrypoint.sh"]
