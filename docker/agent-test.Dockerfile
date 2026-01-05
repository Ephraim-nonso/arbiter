FROM node:20-bookworm-slim

WORKDIR /app

# Copy only what we need to run the agent tests.
# Note: prove tool calls ../zk/scripts/prove.mjs, so we include zk/ too.
COPY agent/package.json agent/package-lock.json ./agent/
COPY zk/package.json zk/package-lock.json ./zk/

# Install dependencies (cached layer)
RUN cd /app/agent && npm ci
RUN cd /app/zk && npm ci

# Copy sources + zk build artifacts
COPY agent ./agent
COPY zk ./zk

WORKDIR /app/agent

# Default: run smoke test. Override with docker-compose command.
CMD ["npm", "run", "test:smoke"]


