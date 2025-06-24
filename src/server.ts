import express from 'express';
import awsServerlessExpress from 'aws-serverless-express';

const app = express();

app.get('/', (_req, res) => {
  res.json({ message: 'Hello from Express + TypeScript + Lambda' });
});

const server = awsServerlessExpress.createServer(app);

// AWS Lambda export
export const handler = (event: any, context: any) => {
  awsServerlessExpress.proxy(server, event, context);
};

// Local dev
if (process.env.NODE_ENV !== 'production' && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}
