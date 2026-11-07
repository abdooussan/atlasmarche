FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production
# Deadlines are stored in Morocco local time: read them in that time zone.
ENV TZ=Africa/Casablanca
RUN apk add --no-cache tzdata

# Install only production dependencies, using the lockfile for exact versions.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src

# Run as the unprivileged "node" user that the image provides.
USER node
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/health || exit 1

CMD ["node", "src/server.js"]
