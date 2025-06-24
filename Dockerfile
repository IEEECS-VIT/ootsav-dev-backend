FROM public.ecr.aws/lambda/nodejs:18

# Copy and build TypeScript
WORKDIR /var/task

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

CMD [ "dist/server.handler" ]
