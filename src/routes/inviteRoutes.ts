import express, { Request, Response } from 'express';
import { 
  generateGroupInviteLink,
  getGroupInviteDetails,
  submitGroupRsvp,
  getGroupRsvpStatus,
  getUserRsvps,
  getEventRsvpSummary,
  getEventGuestList,
  bulkCreateInvites
} from '../services/inviteService';
import { verifyIdToken } from '../middleware/verifyIdToken';
import { isEventHostOrCoHost } from '../services/guestService';

const router = express.Router();

// Generate invite link for a specific group
router.post('/generate/:eventId/:groupId', verifyIdToken, async (req: Request, res: Response) => {
  try {
    const { eventId, groupId } = req.params;
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Check if user is host or co-host
    const isAuthorized = await isEventHostOrCoHost(userId, eventId);
    if (!isAuthorized) {
      res.status(403).json({ message: 'Only event hosts and co-hosts can generate invite links' });
      return;
    }

    const result = await generateGroupInviteLink(eventId, groupId);

    if (!result.success) {
      res.status(400).json({ message: result.error });
      return;
    }

    res.status(200).json({
      message: 'Invite link generated successfully',
      inviteLink: result.inviteLink,
      group: result.group
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Bulk create invites for WhatsApp/Excel imports
router.post('/bulk/:eventId', verifyIdToken, async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    const { invites } = req.body; // Array of { name, phone_no, group_id }

    if (!invites || !Array.isArray(invites) || invites.length === 0) {
      res.status(400).json({ message: 'Invites array is required' });
      return;
    }

    // Check if user is host or co-host
    const isAuthorized = await isEventHostOrCoHost(userId, eventId);
    if (!isAuthorized) {
      res.status(403).json({ message: 'Only event hosts and co-hosts can create invites' });
      return;
    }

    const result = await bulkCreateInvites(eventId, invites);

    if (!result.success) {
      res.status(400).json({ message: result.error });
      return;
    }

    res.status(201).json({
      message: 'Invites created successfully',
      created: result.created,
      failed: result.failed
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Get RSVP summary for an event (host/co-host only)
router.get('/summary/:eventId', verifyIdToken, async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const result = await getEventRsvpSummary(eventId, userId);

    if (!result.success) {
      if (result.error?.includes('Access denied')) {
        res.status(403).json({ message: result.error });
      } else if (result.error?.includes('not found')) {
        res.status(404).json({ message: result.error });
      } else {
        res.status(400).json({ message: result.error });
      }
      return;
    }

    res.status(200).json({
      summary: result.summary,
      totalInvited: result.totalInvited,
      totalConfirmed: result.totalConfirmed
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Get detailed guest list for an event (host/co-host only)
router.get('/guests/:eventId', verifyIdToken, async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    const { rsvp, food, alcohol, accommodation, groupId, includeUnlinked } = req.query;

    const result = await getEventGuestList(eventId, userId, {
      rsvp: rsvp as any,
      food: food as string,
      alcohol: alcohol as string,
      accommodation: accommodation as string,
      groupId: groupId as string,
      includeUnlinked: includeUnlinked === 'true'
    });

    if (!result.success) {
      if (result.error?.includes('Access denied')) {
        res.status(403).json({ message: result.error });
      } else if (result.error?.includes('not found')) {
        res.status(404).json({ message: result.error });
      } else {
        res.status(400).json({ message: result.error });
      }
      return;
    }

    res.status(200).json({
      guests: result.guests
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Get all RSVPs for the current user (protected)
router.get('/my-rsvps', verifyIdToken, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const result = await getUserRsvps(userId);

    if (!result.success) {
      res.status(400).json({ message: result.error });
      return;
    }

    res.status(200).json({
      rsvps: result.rsvps
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Optional authentication middleware for invite routes
const optionalAuth = (req: Request, res: Response, next: any) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // If auth header is present, verify it
    verifyIdToken(req, res, next);
  } else {
    // If no auth header, continue without setting userId
    req.userId = undefined;
    next();
  }
};

// Get group invite details by group ID (public with optional auth)
router.get('/:groupId', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;
    const userId = req.userId; // Will be undefined if not authenticated

    const result = await getGroupInviteDetails(groupId, userId);

    if (!result.success) {
      res.status(404).json({ message: result.error });
      return;
    }

    res.status(200).json({
      group: result.group,
      event: result.event,
      userContext: result.userContext, // Additional info for logged-in users
      isAuthenticated: !!userId
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Submit RSVP for a group (public with optional auth) 
router.post('/:groupId/rsvp', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;
    const userId = req.userId; // Will be undefined if not authenticated
    const { name, phone_no, email, rsvp, food, alcohol, accommodation, count } = req.body;

    // Validation for anonymous submissions
    if (!userId) {
      if (!name || !phone_no || !rsvp) {
        res.status(400).json({ message: 'Name, phone number, and RSVP status are required' });
        return;
      }
    } else {
      // For authenticated users, only RSVP is required (name/phone from user account)
      if (!rsvp) {
        res.status(400).json({ message: 'RSVP status is required' });
        return;
      }
    }

    const validRsvpStatuses = ['accepted', 'declined', 'maybe'];
    if (!validRsvpStatuses.includes(rsvp)) {
      res.status(400).json({ message: 'Invalid RSVP status' });
      return;
    }

    const result = await submitGroupRsvp(groupId, {
      name,
      phone_no,
      email,
      rsvp,
      food,
      alcohol,
      accommodation,
      count
    }, userId); // Pass userId to service

    if (!result.success) {
      res.status(400).json({ message: result.error });
      return;
    }

    res.status(200).json({
      message: result.message,
      guest: result.guest,
      user: result.user,
      isAuthenticated: !!userId,
      wasAuthenticated: result.wasAuthenticated,
      showAppDownload: result.showAppDownload || false
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Get RSVP status for a phone number in a group (public)
router.get('/:groupId/status/:phoneNo', async (_req: Request, res: Response) => {
  res.status(403).json({ message: 'RSVP status can be viewed and managed in the app. Please download the app to continue.' });
});

export default router;