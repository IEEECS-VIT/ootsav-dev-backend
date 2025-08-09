import express, { Request, Response } from 'express';
import { sendOTP, verifyOTP } from '../services/twilioService';
import { createUser } from '../services/userService';
import { PrismaClient, Gender, Language } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { parseMultipartForm, uploadFilesToSupabase } from '../lib/fileUpload';

const router = express.Router();
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

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
  try {
    const { fields, files } = await parseMultipartForm(req);
    
    const { name, dob, mobile_number, email, gender, preferred_language } = fields;
    
    let profilePicUrl = '';
    if (files && files.length > 0) {
      const uploadedUrls = await uploadFilesToSupabase(files, 'profile-pics');
      if (uploadedUrls.length > 0) {
        profilePicUrl = uploadedUrls[0];
      }
    }
    
    const user = await createUser({
      name,
      dob,
      mobile_number,
      email,
      gender: gender as Gender,
      profile_pic: profilePicUrl,
      preferred_language: preferred_language as Language,
    });
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({ token, user });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || 'User creation failed' });
  }
});

export default router; 
