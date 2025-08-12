import express, { Request, Response } from 'express';
import { sendOTP, verifyOTP } from '../services/twilioService';
import { createUser, getUserByPhoneNumber, verifyUser } from '../services/userService';
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

    const user = await getUserByPhoneNumber(phone);

    if (!user) {
      // User doesn't exist, store phone and prompt for onboarding
      await prisma.verifiedPhone.upsert({
        where: { phone },
        update: {},
        create: { phone },
      });
      res.json({
        success: true,
        isNewUser: true,
        message: 'OTP verified. User does not exist, please complete onboarding.',
      });
      return;
    }

    // User exists, update verification status
    if (user.verification_status !== 'verified') {
      await verifyUser(user.id);
    }

    const updatedUser = await getUserByPhoneNumber(phone);
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: updatedUser,
      isNewUser: false,
      message: 'User verified successfully',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

router.post('/onboard', async (req: Request, res: Response) => {
  try {
    const { fields, files } = await parseMultipartForm(req);
    
    const { name, dob, mobile_number, email, gender, preferred_language, verified_phone } = fields;
    
    // Check if the phone number was actually verified
    const isPhoneVerified = await prisma.verifiedPhone.findUnique({
      where: { phone: mobile_number },
    });

    if (!isPhoneVerified) {
      res.status(400).json({ error: 'Phone number is not verified. Please verify with OTP first.' });
      return;
    }
    
    // Check if user already exists
    const existingUser = await getUserByPhoneNumber(mobile_number);
    if (existingUser) {
      res.status(400).json({ error: 'User already exists with this phone number' });
      return;
    }
    
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
      verification_status: 'verified' 
    });
    
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({ 
      token, 
      user,
      message: 'User onboarded successfully'
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || 'User creation failed' });
  }
});

router.post('/upgrade-to-verified', async (req: Request, res: Response) => {
  const { phone, code } = req.body;
  
  if (!phone || !code) {
    res.status(400).json({ error: 'Phone number and code are required' });
    return;
  }

  try {
    // Verify OTP first
    const otpResult = await verifyOTP(phone, code);
    if (!otpResult) {
      res.status(400).json({ error: 'Invalid OTP' });
      return;
    }

    // Find the unverified user
    const user = await getUserByPhoneNumber(phone);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (user.verification_status === 'verified') {
      res.status(400).json({ error: 'User is already verified' });
      return;
    }

    // Upgrade user to verified
    const verifyResult = await verifyUser(user.id);
    if (!verifyResult.success) {
      res.status(500).json({ error: 'Failed to verify user' });
      return;
    }

    // Generate new token
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({ 
      token, 
      user: verifyResult.user,
      message: 'User upgraded to verified successfully'
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Route to check verification status
router.get('/verification-status/:phone', async (req: Request, res: Response) => {
  try {
    const { phone } = req.params;
    
    const user = await getUserByPhoneNumber(phone);
    if (!user) {
      res.json({ 
        exists: false,
        verified: false 
      });
      return;
    }

    res.json({ 
      exists: true,
      verified: user.verification_status === 'verified',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        verification_status: user.verification_status
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to check verification status' });
  }
});

export default router;