# Brand-Coach MCP gateway — self-contained runtime image.
#
# Runs the esbuild bundle (dist-mcp/server.mjs) with plain Node — no tsx, no
# node_modules. Build context is the REPO ROOT so the COPY can reach dist-mcp/.
# Build (from repo root):  npm run mcp:build:docker
#
# This image has no coupling to the Vite SPA; it can be lifted into a standalone
# repo by moving deploy/mcp/ + scripts/build-mcp.mjs + src/mcp/ together.
FROM node:20-slim

WORKDIR /app

# The single bundled entry point (created by `npm run mcp:bundle`).
COPY dist-mcp/server.mjs ./server.mjs

ENV NODE_ENV=production
ENV MCP_PORT=8787
EXPOSE 8787

# Drop privileges to the image's built-in non-root user.
USER node

# Liveness: hit the gateway's own /healthz (node:20 ships a global fetch).
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.MCP_PORT||8787)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.mjs"]
