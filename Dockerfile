###########
# WebVOWL #
###########

# Stage 1: Build
# Node 12 is the safe ceiling for webpack 1.x / grunt 1.x compatibility
FROM node:12.22.12-alpine3.15 AS builder
WORKDIR /app

# Install dependencies first for better layer caching.
# --ignore-scripts skips the postinstall grunt release so we can copy
# source files before building.
COPY package.json ./
RUN npm install --ignore-scripts

# Copy source and build into deploy/
COPY . .
RUN ./node_modules/.bin/grunt release

# Stage 2: Serve static output
FROM nginx:1.29.5-alpine
COPY --from=builder /app/deploy /usr/share/nginx/html
EXPOSE 80
