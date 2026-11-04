# Multi-stage: build the React client, then run the Express server that
# serves both the API and the built frontend on one port (same-origin).
FROM node:22-slim AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY client/ ./
RUN npm run build

FROM node:22-slim AS server
WORKDIR /app
ENV NODE_ENV=production
COPY server/package.json server/package-lock.json* ./server/
RUN npm --prefix server install --omit=dev --no-audit --no-fund
COPY server/src ./server/src
COPY --from=client-build /app/client/dist ./client/dist
EXPOSE 4000
# DATA_DIR must point at a persistent volume in production, e.g. -v dumhouse-data:/data
# JWT_SECRET and PORT are supplied by the environment — never baked into the image.
CMD ["node", "server/src/server.js"]
