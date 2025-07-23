import express, { Request, Response } from 'express';
import { sendOTP, verifyOTP } from '../services/twilioService';
import { createUser } from '../services/userService';
import { PrismaClient, Gender, Language } from '@prisma/client';
import jwt from 'jsonwebtoken';

const router = express.Router();
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET!

router.post('/otp/send', async (req: Request, res: Response) => {
  const { phone } = req.body;
  if (!phone) {
    res.status(400).json({ error: 'Phone number is required' });
    return;
  }

  try {
    await sendOTP(phone);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

router.post('/otp/verify', async (req: Request, res: Response): Promise<void> => {
  const { phone, code } = req.body;
  if (!phone || !code) {
    res.status(400).json({ error: 'Phone number and code are required' });
    return;
  }

  try {
    const result = await verifyOTP(phone, code);
    if (!result) {
      res.status(400).json({ error: 'Invalid OTP' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { mobile_number: phone },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

router.post('/onboard', async (req: Request, res: Response) => {
  const { name, dob, mobile_number, email, gender, profile_pic, preferred_language } = req.body;

  try {
    const user = await createUser({
      name,
      dob,
      mobile_number,
      email,
      gender: gender as Gender,
      profile_pic: profile_pic || '',
      preferred_language: preferred_language as Language,
    });
    res.json(user);
  } catch (error: any) {33
    console.error(error);
    res.status(500).json({ error: error.message || 'User creation failed' });
  }
});

export default router; 
