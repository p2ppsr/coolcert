# ------------------------------------------------------------------------------
# 1) Builder Stage: builds TypeScript
# ------------------------------------------------------------------------------
FROM node:22.23.4-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS builder
RUN test "$(node --version)" = "v22.23.4"
WORKDIR /app

# Copy only the manifest files first for better caching
COPY package*.json ./
RUN npm install

# Copy the rest of the code
COPY . ./

# Build the TypeScript project
RUN npm run build

# ------------------------------------------------------------------------------
# 2) Production Stage: runs the app
# ------------------------------------------------------------------------------
FROM node:22.23.4-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914
RUN test "$(node --version)" = "v22.23.4"
WORKDIR /app

# Copy the build output from the builder
COPY --from=builder /app/out ./out

# Copy only the production dependencies
COPY package*.json ./
RUN npm ci --production

# Expose is optional - Cloud Run ignores it, but good for local usage
EXPOSE 8080

# Start command
CMD ["node", "out/index.js"]
