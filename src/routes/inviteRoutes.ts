import express, { Request, Response } from 'express';
import {
  generateGroupInviteLink,
  getGroupInviteDetails,
  submitGroupRsvp,
  getUserRsvps,
  getUserRsvpForEvent,
  getUserRsvpByGroup,
  updateUserRsvp,
  getEventRsvpSummary,
  getEventGuestList,
  bulkCreateInvites,
  sendWhatsappInvite
} from '../services/inviteService';
import { verifyIdToken } from '../middleware/verifyIdToken';
import { isEventHostOrCoHost } from '../services/guestService';
import { getRsvpPreferencesForGroup } from '../services/rsvpPreferencesService';

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

// Get authenticated user's RSVP for a specific event
router.get('/rsvp/event/:eventId', verifyIdToken, async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const result = await getUserRsvpForEvent(userId, eventId);

    if (!result.success) {
      if (result.error?.includes('not found')) {
        res.status(404).json({ message: result.error });
      } else {
        res.status(400).json({ message: result.error });
      }
      return;
    }

    res.status(200).json({
      rsvp: result.rsvp
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Get authenticated user's RSVP by group ID
router.get('/rsvp/event/:eventId/group/:groupId', verifyIdToken, async (req: Request, res: Response) => {
  try {
    const { eventId, groupId } = req.params;
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const result = await getUserRsvpByGroup(userId, eventId, groupId);

    if (!result.success) {
      if (result.error?.includes('not found')) {
        res.status(404).json({ message: result.error });
      } else {
        res.status(400).json({ message: result.error });
      }
      return;
    }

    res.status(200).json({
      rsvp: result.rsvp
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Update authenticated user's RSVP for a specific event
router.put('/rsvp/event/:eventId', verifyIdToken, async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    const { rsvp, food, alcohol, pickup_date_time, pickup_location, dropoff_date_time, dropoff_location, count, name, email, phone_no,
      personal_note } = req.body;

    // Validate RSVP status
    const validRsvpStatuses = ['accepted', 'declined', 'maybe'];
    if (!rsvp || !validRsvpStatuses.includes(rsvp)) {
      res.status(400).json({ message: 'Valid RSVP status is required (accepted, declined, maybe)' });
      return;
    }

    const result = await updateUserRsvp(userId, eventId, {
      rsvp,
      food,
      alcohol,
      personal_note,
      pickup_date_time: pickup_date_time ? new Date(pickup_date_time) : undefined,
      pickup_location,
      dropoff_date_time: dropoff_date_time ? new Date(dropoff_date_time) : undefined,
      dropoff_location,
      count,
      name,
      email,
      phone_no
    });

    if (!result.success) {
      if (result.error?.includes('not found')) {
        res.status(404).json({ message: result.error });
      } else if (result.error?.includes('already started')) {
        res.status(400).json({ message: result.error });
      } else {
        res.status(400).json({ message: result.error });
      }
      return;
    }

    res.status(200).json({
      message: result.message,
      rsvp: result.rsvp
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
    const { rsvp, food, alcohol, groupId, includeUnlinked } = req.query;

    const result = await getEventGuestList(eventId, userId, {
      rsvp: rsvp as any,
      food: food as string,
      alcohol: alcohol as string,
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
      guests: result.guests,
      linkedGuests: result.linkedGuests,
      unlinkedGuests: result.unlinkedGuests,
      summary: result.summary
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

// ===== PUBLIC ROUTES WITH OPTIONAL AUTH =====

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
router.get('/:eventId/:groupId', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { eventId, groupId } = req.params;
    const userId = req.userId; // Will be undefined if not authenticated

    // Get both group invite details and RSVP preferences in parallel
    const [groupDetailsResult, rsvpPreferencesResult] = await Promise.all([
      getGroupInviteDetails(eventId, groupId, userId),
      getRsvpPreferencesForGroup(eventId, groupId)
    ]);

    if (!groupDetailsResult.success) {
      res.status(404).json({ message: groupDetailsResult.error });
      return;
    }

    // Prepare response with group details
    const response: any = {
      group: groupDetailsResult.group,
      event: groupDetailsResult.event,
      userContext: groupDetailsResult.userContext, // Additional info for logged-in users
      isAuthenticated: !!userId
    };

    // Expose co-hosts and sub-events in a friendly shape when available
    if (groupDetailsResult.event) {
      const ev: any = groupDetailsResult.event;
      if (ev.co_hosts) {
        response.coHosts = ev.co_hosts.map((c: any) => ({
          id: c.id,
          name: c.name,
          mobileNumber: c.mobile_number,
          profilePic: c.profile_pic
        }));
      }
      if (ev.sub_events) {
        response.subEvents = ev.sub_events.map((s: any) => ({
          id: s.id,
          title: s.title,
          location: s.location,
          address: s.address,
          inviteMessage: s.invite_message,
          image: s.image,
          startDateTime: s.start_date_time,
          endDateTime: s.end_date_time
        }));
      }

      // Remove the nested fields on the event object so they don't appear twice
      if (ev.co_hosts) delete ev.co_hosts;
      if (ev.sub_events) delete ev.sub_events;
    }

    // Add RSVP preferences if available
    if (rsvpPreferencesResult.success && rsvpPreferencesResult.preferences) {
      const preferences = rsvpPreferencesResult.preferences;
      response.rsvpPreferences = {
        formConfig: {
          collectAttendance: preferences.collect_attendance,
          collectGuestCount: preferences.collect_guest_count,
          collectFood: preferences.collect_food,
          collectAlcohol: preferences.collect_alcohol,
          collectAccommodation: preferences.collect_accommodation,
          accommodationDetails: preferences.accommodation_details,
          collectTransport: preferences.collect_transport,
          transportDetails: preferences.transport_details,
          additionalNotes: preferences.additional_notes,
          isRsvpAllowed: preferences.isRsvpAllowed,
          rsvpLockDate: preferences.rsvp_lock_date,
          daysUntilLock: preferences.daysUntilLock
        },
        group: preferences.group ? {
          id: preferences.group.id,
          name: preferences.group.name
        } : null
      };
    } else {
      // If no RSVP preferences found, set defaults
      response.rsvpPreferences = {
        formConfig: {
          collectAttendance: true,
          collectGuestCount: true,
          collectFood: false,
          collectAlcohol: false,
          collectAccommodation: false,
          accommodationDetails: null,
          collectTransport: false,
          transportDetails: null,
          additionalNotes: null,
          isRsvpAllowed: true,
          rsvpLockDate: null,
          daysUntilLock: null
        },
        group: null
      };
    }

    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Submit RSVP for a group (public with optional auth) 
router.post('/:eventId/:groupId/rsvp', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { eventId, groupId } = req.params;
    const userId = req.userId;
    const {
      name, phone_no, email, rsvp, food, alcohol,
      pickup_date_time, pickup_location, dropoff_date_time, dropoff_location, count,
      personal_note
    } = req.body;

    // Validation
    if (!name || !phone_no || !rsvp) {
      res.status(400).json({ message: 'Name, phone number, and RSVP status are required' });
      return;
    }

    const result = await submitGroupRsvp(eventId, groupId, {
      name,
      phone_no,
      email,
      rsvp,
      food,
      alcohol,
      personal_note,
      pickup_date_time: pickup_date_time ? new Date(pickup_date_time) : undefined,
      pickup_location,
      dropoff_date_time: dropoff_date_time ? new Date(dropoff_date_time) : undefined,
      dropoff_location,
      count
    }, userId);

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
router.get('/:eventId/:groupId/status/:phoneNo', async (_req: Request, res: Response) => {
  res.status(403).json({ message: 'RSVP status can be viewed and managed in the app. Please download the app to continue.' });
});

router.post(
    '/send-invite/:eventId/:groupId',
    verifyIdToken,
    async (req: Request, res: Response) => {
        try {
            const { eventId, groupId } = req.params;
            const { name, phone_no } = req.body;
            const userId = req.userId; // This is the ID of the user sending the invite
            if (!userId) {
                res.status(401).json({ message: 'Unauthorized' });
                return;
            }

            const isAuthorized = await isEventHostOrCoHost(userId, eventId);
            if (!isAuthorized) {
                return res.status(403).json({ message: 'Only event hosts can send invites' });
            }

            // Pass the sender's userId to the service function
            const result = await sendWhatsappInvite(userId, eventId, groupId, name, phone_no);

            if (!result.success) {
                return res.status(400).json({ message: result.error });
            }
            
            res.status(200).json({ message: 'Invite link sent successfully' });
        } catch (error: any) {
            console.error(error);
            res.status(500).json({ message: error.message || 'Internal Server Error' });
        }
    }
);
export default router;