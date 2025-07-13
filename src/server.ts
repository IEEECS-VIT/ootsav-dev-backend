import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import awsServerlessExpress from 'aws-serverless-express';
import profileRoutes from './routes/profile'
import eventRoutes from './routes/event'
import onboardingRoutes from './routes/onboarding';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/profile', profileRoutes)
app.use('/api/event', eventRoutes)
app.use('/api', onboardingRoutes); 

app.get('/', (_req, res) => {
  res.json({ message: 'Get lost' });
});

const server = awsServerlessExpress.createServer(app);

export const handler = (event: any, context: any) => {
  awsServerlessExpress.proxy(server, event, context);
};

async function startServer() {
  try {
    await prisma.$connect();
    console.log('Connected to DB');
  } catch (err) {
    console.error('Failed to connect to DB:', err);
    process.exit(1);
  }
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

if (process.env.NODE_ENV !== 'production' && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  startServer();
}
