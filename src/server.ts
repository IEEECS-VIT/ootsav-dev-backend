import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import awsServerlessExpress from 'aws-serverless-express';
import onboardingRoutes from './routes/onboarding.js'; // ✅ FIXED PATH
import profileRoutes from './routes/profile.js'

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', onboardingRoutes); // ✅ working route prefix
app.use('/api/profile', profileRoutes)

app.get('/', (_req, res) => {
  res.json({ message: 'Hello from Express + TypeScript + Lambda' });
});

const server = awsServerlessExpress.createServer(app);

export const handler = (event: any, context: any) => {
  awsServerlessExpress.proxy(server, event, context);
};

if (process.env.NODE_ENV !== 'production' && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}
