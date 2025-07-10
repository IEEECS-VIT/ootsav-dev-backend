import express, { Request, Response } from 'express';
import { sendOTP, verifyOTP } from '../services/twilio';
import { createUser } from '../services/userservice';
import { Gender } from '@prisma/client';

const router = express.Router();


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


router.post('/otp/verify', async (req: Request, res: Response) => {
  const { phone, code } = req.body;
  try {
    const result = await verifyOTP(phone, code);
    if (result.status === 'approved') {
      res.json({ success: true });
      return;
    }
    res.status(400).json({ error: 'Incorrect OTP' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Verification failed' });
  }
});


router.post('/onboard', async (req: Request, res: Response) => {
  const { name, dob, mobile_number, email, gender, profile_pic } = req.body;

  try {
    const user = await createUser({
      name,
      dob,
      mobile_number,
      email,
      gender: gender as Gender,
      profile_pic: profile_pic || '',
    });
    res.json(user);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || 'User creation failed' });
  }
});

export default router; 
