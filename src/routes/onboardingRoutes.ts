import express, { Request, Response } from 'express';
import { sendOTP, verifyOTP } from '../services/twilioService';
import { createUser, getUserByPhoneNumber, verifyUser, linkUserRsvps, checkUnlinkedRsvps, createUserWithRsvpLinking } from '../services/userService';
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

    let user = await getUserByPhoneNumber(phone);

    if (user) {
      // User exists - mark them as verified if they weren't already
      if (user.verification_status === 'unverified') {
        const verifyResult = await verifyUser(user.id);
        if (verifyResult.success && verifyResult.user) {
          user = verifyResult.user;
          
          // Also link any unlinked RSVPs when user gets verified
          const linkResult = await linkUserRsvps(user.id, phone);
          
          const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
          res.json({ 
            token, 
            user,
            isNewUser: false,
            linkedRsvps: linkResult.success ? {
              count: linkResult.linkedCount,
              message: linkResult.message
            } : null,
            message: 'User verified successfully'
          });
        } else {
          res.status(500).json({ error: 'Failed to verify user' });
          return;
        }
      } else {
        // User is already verified, just generate token
        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ 
          token, 
          user,
          isNewUser: false,
          message: 'User verified successfully'
        });
      }
    } else {
      // New user - check if they have any unlinked RSVPs
      const unlinkedCheck = await checkUnlinkedRsvps(phone);
      
      await prisma.verifiedPhone.create({
        data: { phone },
      });

      res.json({
        success: true,
        isNewUser: true,
        verifiedPhone: phone,
        hasUnlinkedRsvps: unlinkedCheck.success ? unlinkedCheck.hasUnlinkedRsvps : false,
        unlinkedRsvpCount: unlinkedCheck.success ? unlinkedCheck.count : 0,
        message: 'OTP verified. Please complete onboarding.',
      });
    }
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
    
    // Create user with automatic RSVP linking
    const createResult = await createUserWithRsvpLinking({
      name,
      dob,
      mobile_number,
      email,
      gender: gender as Gender,
      profile_pic: profilePicUrl,
      preferred_language: preferred_language as Language,
      verification_status: 'verified' // Always verified if they reach this point
    });

    if (!createResult.success) {
      res.status(500).json({ error: createResult.error });
      return;
    }
    
    if (!createResult.user) {
      res.status(500).json({ error: 'User creation failed' });
      return;
    }
    const token = jwt.sign({ userId: createResult.user.id }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({ 
      token, 
      user: createResult.user,
      linkedRsvps: createResult.linkedRsvps,
      message: 'User onboarded successfully'
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || 'User creation failed' });
  }
});

// New route to upgrade unverified user to verified (when they complete OTP later)
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
    if (!verifyResult.success || !verifyResult.user) {
      res.status(500).json({ error: 'Failed to verify user' });
      return;
    }

    // Link any unlinked RSVPs
    const linkResult = await linkUserRsvps(verifyResult.user.id, phone);

    // Generate new token
    const token = jwt.sign({ userId: verifyResult.user.id }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({ 
      token, 
      user: verifyResult.user,
      linkedRsvps: linkResult.success ? {
        count: linkResult.linkedCount,
        message: linkResult.message
      } : null,
      message: 'User upgraded to verified successfully'
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Route to check verification status and unlinked RSVPs
router.get('/verification-status/:phone', async (req: Request, res: Response) => {
  try {
    const { phone } = req.params;
    
    const user = await getUserByPhoneNumber(phone);
    if (!user) {
      // Check for unlinked RSVPs even if user doesn't exist
      const unlinkedCheck = await checkUnlinkedRsvps(phone);
      
      res.json({ 
        exists: false,
        verified: false,
        hasUnlinkedRsvps: unlinkedCheck.success ? unlinkedCheck.hasUnlinkedRsvps : false,
        unlinkedRsvpCount: unlinkedCheck.success ? unlinkedCheck.count : 0
      });
      return;
    }

    res.json({ 
      exists: true,
      verified: user.verification_status === 'verified',
      hasUnlinkedRsvps: false, // If user exists, RSVPs should already be linked
      unlinkedRsvpCount: 0,
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

// New route to check unlinked RSVPs for a phone number
router.get('/check-rsvps/:phone', async (req: Request, res: Response) => {
  try {
    const { phone } = req.params;
    
    const result = await checkUnlinkedRsvps(phone);
    
    if (!result.success) {
      res.status(500).json({ error: result.error });
      return;
    }

    res.json({
      hasUnlinkedRsvps: result.hasUnlinkedRsvps,
      count: result.count,
      events: result.unlinkedRsvps?.map(rsvp => ({
        eventId: rsvp.event.id,
        eventTitle: rsvp.event.title,
        eventType: rsvp.event.type,
        eventDate: rsvp.event.start_date_time,
        rsvpStatus: rsvp.rsvp
      })) || []
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to check RSVPs' });
  }
});

export default router;