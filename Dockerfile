# Builds and runs the JsonFabrica MCP server over stdio.
#
# Used by MCP registries (e.g. Glama) for automated introspection checks, and
# runnable directly:
#   docker build -t jsonfabrica-mcp-server .
#   docker run -i --rm -e JSONFABRICA_API_KEY=sk_live_... jsonfabrica-mcp-server
#
# Tool discovery (tools/list) works without an API key; individual tool calls
# require JSONFABRICA_API_KEY.

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
ENTRYPOINT ["node", "dist/index.js"]
