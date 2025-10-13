# Use a standard Node.js image instead of the Lambda-specific one
FROM node:22-alpine

WORKDIR /usr/src/app

COPY package*.json ./
# Install production dependencies
RUN npm install --omit=dev

COPY . .
# Build your TypeScript code
RUN npm run build

# Expose the port your app will run on
EXPOSE 3000

# Change the command to start the server directly
CMD [ "node", "dist/server.js" ]