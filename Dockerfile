# --- Stage 1: Build the application ---
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

# Copy package files and prisma schema
COPY package*.json ./
COPY prisma ./prisma/

# Install ALL dependencies (including dev dependencies)
RUN npm install

# Explicitly generate the Prisma client to create all the necessary types
RUN npx prisma generate

# Copy the rest of your source code
COPY . .

# Build the TypeScript project
RUN npm run build

# Remove development dependencies to prepare for the final image
RUN npm prune --production


# --- Stage 2: Create the final, lightweight image ---
FROM node:22-alpine

WORKDIR /usr/src/app

# Copy only the necessary files from the 'builder' stage
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma

# Expose the port your app will run on
EXPOSE 3000

# Start the server
CMD [ "node", "dist/server.js" ]
