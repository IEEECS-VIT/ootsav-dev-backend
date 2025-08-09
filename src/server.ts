import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import serverlessExpress from '@vendia/serverless-express';
import busboy from 'busboy';
import profileRoutes from './routes/profileRoutes'
import eventRoutes from './routes/eventRoutes'
import guestRoutes from './routes/guestRoutes'
import subEventRoutes from './routes/subEventRoutes'
import rsvpRoutes from './routes/rsvpRoutes'
import onboardingRoutes from './routes/onboardingRoutes';
import { PrismaClient } from '@prisma/client';


const prisma = new PrismaClient();
const app = express();

// Enhanced CORS configuration
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Enhanced JSON parsing with error handling
app.use(express.json({ 
  limit: '10mb',
  strict: false 
}));

app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
    // Skip body parsing for multipart requests as they will be handled by busboy
    next();
  } else {
    express.json({ limit: '10mb' })(req, res, next);
  }
});

// // Add request logging middleware for debugging
// app.use((req, res, next) => {
//   console.log(`${req.method} ${req.path}`, {
//     body: req.body,
//     headers: req.headers,
//     query: req.query
//   });
//   next();
// });

// Error handling middleware for JSON parsing
app.use(((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (error instanceof SyntaxError && 'body' in error) {
    console.error('JSON Parse Error:', error.message);
    return res.status(400).json({ error: 'Invalid JSON format' });
  }
  next();
}) as express.ErrorRequestHandler);


app.use('/api/profile', profileRoutes)
app.use('/api/event', eventRoutes)
app.use('/api/guests', guestRoutes)
app.use('/api/:eventId/subEvent', subEventRoutes)
app.use('/api', onboardingRoutes); 
app.use('/api/rsvp', rsvpRoutes);

app.get('/', (_req, res) => {
  res.json({ message: 'Get lost' });
});

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Error:', error);
  res.status(500).json({ error: 'Internal server error', message: error.message });
});

// Create the serverless handler with configuration
export const handler = serverlessExpress({ 
  app,
  binaryMimeTypes: [
    'application/octet-stream',
    'font/*',
    'image/*',
    'video/*',
    'audio/*'
  ]
});

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