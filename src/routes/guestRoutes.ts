import express, { Request, Response } from 'express';
import {
  getGuestGroups,
  getGuestGroup,
  isEventHostOrCoHost,
  addGuestGroupToEvent,
  createGuestGroup,
  updateGuestGroup,
  deleteGuestGroup,
  addUserToGroup,
  removeUserFromGroup,
  getMyGuestGroups,
  getAvailableGuestGroupsForEvent,
  removeGuestGroupFromEvent,
  addSingleGuest,
  bulkAddGuests
} from '../services/guestService';
import { verifyIdToken } from '../middleware/verifyIdToken';

const router = express.Router();

// Get all guest groups created by the current user (standalone route)
router.get('/my-groups', verifyIdToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const result = await getMyGuestGroups(userId);

    if (!result.success) {
      res.status(400).json({ message: result.error });
      return;
    }

    res.status(200).json({
      message: 'Guest groups retrieved successfully',
      guestGroups: result.guestGroups,
      totalGroups: result.totalGroups
    });
  } catch (error) {
    console.error('Get my guest groups error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Create a new guest group for an event
router.post('/:eventId/groups', verifyIdToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;
    const userId = req.userId;
    
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    
    const { name } = req.body;

    if (!name) {
      res.status(400).json({ message: 'Group name is required' });
      return;
    }

    const isAuthorized = await isEventHostOrCoHost(userId, eventId);
    if (!isAuthorized) {
      res.status(403).json({ message: 'Only event hosts and co-hosts can create guest groups' });
      return;
    }

    const result = await createGuestGroup({ name, createdBy: userId, eventId });

    if (!result.success) {
      res.status(400).json({ message: result.error });
      return;
    }

    res.status(201).json({
      message: 'Guest group created successfully',
      guestGroup: result.guestGroup
    });
  } catch (error) {
    console.error('Create guest group error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Add an existing guest group to an event
router.post('/:eventId/groups/:groupId', verifyIdToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId, groupId } = req.params;
    const userId = req.userId;
    
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const isAuthorized = await isEventHostOrCoHost(userId, eventId);
    if (!isAuthorized) {
      res.status(403).json({ message: 'Only event hosts and co-hosts can add guest groups to an event' });
      return;
    }

    const result = await addGuestGroupToEvent(eventId, groupId);

    if (!result.success) {
      res.status(400).json({ message: result.error });
      return;
    }

    res.status(200).json({
      message: 'Guest group added to event successfully',
      guests: result.guests
    });
  } catch (error) {
    console.error('Add guest group to event error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Remove a guest group from an event (but keep the group itself)
router.delete('/:eventId/groups/:groupId/remove', verifyIdToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId, groupId } = req.params;
    const userId = req.userId;
    
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const isAuthorized = await isEventHostOrCoHost(userId, eventId);
    if (!isAuthorized) {
      res.status(403).json({ message: 'Only event hosts and co-hosts can remove guest groups from an event' });
      return;
    }

    const result = await removeGuestGroupFromEvent(eventId, groupId);

    if (!result.success) {
      res.status(400).json({ message: result.error });
      return;
    }

    res.status(200).json({
      message: result.message
    });
  } catch (error) {
    console.error('Remove guest group from event error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Get available guest groups that can be added to a specific event
router.get('/:eventId/available-groups', verifyIdToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;
    const userId = req.userId;
    
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Check if user is host or co-host of the event
    const isAuthorized = await isEventHostOrCoHost(userId, eventId);
    if (!isAuthorized) {
      res.status(403).json({ message: 'Only event hosts and co-hosts can view available guest groups' });
      return;
    }

    const result = await getAvailableGuestGroupsForEvent(userId, eventId);

    if (!result.success) {
      res.status(400).json({ message: result.error });
      return;
    }

    res.status(200).json({
      message: 'Available guest groups retrieved successfully',
      availableGroups: result.availableGroups,
      totalAvailable: result.totalAvailable
    });
  } catch (error) {
    console.error('Get available guest groups error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Get all guest groups for an event
router.get('/:eventId/groups', verifyIdToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;
    const userId = req.userId;
    
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const isAuthorized = await isEventHostOrCoHost(userId, eventId);
    if (!isAuthorized) {
      res.status(403).json({ message: 'Only event hosts and co-hosts can view guest groups' });
      return;
    }

    const result = await getGuestGroups(eventId);

    if (!result.success) {
      res.status(400).json({ message: result.error });
      return;
    }

    res.status(200).json({
      guestGroups: result.guestGroups
    });
  } catch (error) {
    console.error('Get guest groups error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Get a specific guest group
router.get('/:eventId/groups/:groupId', verifyIdToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId, groupId } = req.params;
    const userId = req.userId;
    
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const isAuthorized = await isEventHostOrCoHost(userId, eventId);
    if (!isAuthorized) {
      res.status(403).json({ message: 'Only event hosts and co-hosts can view guest groups' });
      return;
    }

    const result = await getGuestGroup(groupId);

    if (!result.success) {
      res.status(404).json({ message: result.error });
      return;
    }

    res.status(200).json({
      guestGroup: result.guestGroup
    });
  } catch (error) {
    console.error('Get guest group error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Update a guest group
router.put('/:eventId/groups/:groupId', verifyIdToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId, groupId } = req.params;
    const userId = req.userId;
    
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    
    const { name } = req.body;

    const isAuthorized = await isEventHostOrCoHost(userId, eventId);
    if (!isAuthorized) {
      res.status(403).json({ message: 'You are not authorized to update this guest group' });
      return;
    }

    const result = await updateGuestGroup(groupId, { name });

    if (!result.success) {
      res.status(400).json({ message: result.error });
      return;
    }

    res.status(200).json({
      message: 'Guest group updated successfully',
      guestGroup: result.guestGroup
    });
  } catch (error) {
    console.error('Update guest group error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Delete a guest group permanently
router.delete('/:eventId/groups/:groupId', verifyIdToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId, groupId } = req.params;
    const userId = req.userId;
    
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const isAuthorized = await isEventHostOrCoHost(userId, eventId);
    if (!isAuthorized) {
      res.status(403).json({ message: 'You are not authorized to delete this guest group' });
      return;
    }

    const result = await deleteGuestGroup(groupId);

    if (!result.success) {
      res.status(400).json({ message: result.error });
      return;
    }

    res.status(200).json({
      message: result.message
    });
  } catch (error) {
    console.error('Delete guest group error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Add user to a guest group by phone number
router.post('/:eventId/groups/:groupId/members', verifyIdToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId, groupId } = req.params;
    const userId = req.userId;
    
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      res.status(400).json({ message: 'Phone number is required' });
      return;
    }

    const isAuthorized = await isEventHostOrCoHost(userId, eventId);
    if (!isAuthorized) {
      res.status(403).json({ message: 'You are not authorized to add members to this guest group' });
      return;
    }

    const result = await addUserToGroup(groupId, phoneNumber, userId);

    if (!result.success) {
      res.status(400).json({ message: result.error });
      return;
    }

    res.status(200).json({
      message: result.message,
      member: result.member
    });
  } catch (error) {
    console.error('Add user to group error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Remove user from a guest group by phone number
router.delete('/:eventId/groups/:groupId/members', verifyIdToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId, groupId } = req.params;
    const userId = req.userId;
    
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      res.status(400).json({ message: 'Phone number is required' });
      return;
    }

    const isAuthorized = await isEventHostOrCoHost(userId, eventId);
    if (!isAuthorized) {
      res.status(403).json({ message: 'You are not authorized to remove members from this guest group' });
      return;
    }

    const result = await removeUserFromGroup(groupId, phoneNumber);

    if (!result.success) {
      res.status(400).json({ message: result.error });
      return;
    }

    res.status(200).json({
      message: result.message
    });
  } catch (error) {
    console.error('Remove user from group error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


// Add a single guest to an event
// Flow 2: Manually add one guest
router.post('/:eventId/guests/add', verifyIdToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return; // Use return here to exit the function
    }

    const { name, phone_no, group_id, email, relation, gender } = req.body;
    if (!name || !phone_no) {
      res.status(400).json({ message: 'Guest name and phone number are required.' });
      return;
    }

    const isAuthorized = await isEventHostOrCoHost(userId, eventId);
    if (!isAuthorized) {
      res.status(403).json({ message: 'Only event hosts or co-hosts can add guests.' });
      return;
    }

    const result = await addSingleGuest(eventId, { name, phone_no, group_id, email, relation, gender });

    if (!result.success) {
      res.status(400).json({ message: result.error });
      return;
    }

    res.status(201).json({ message: result.message, guest: result.guest });

  } catch (error) {
    console.error('Add single guest error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Bulk add guests to an event
// Flow 3 (Contacts) & Flow 4 (Excel)
router.post('/:eventId/guests/bulk-add', verifyIdToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { guests } = req.body; // Expects an array of guest objects
    if (!Array.isArray(guests) || guests.length === 0) {
      res.status(400).json({ message: 'A non-empty array of guests is required.' });
      return;
    }

    const isAuthorized = await isEventHostOrCoHost(userId, eventId);
    if (!isAuthorized) {
      res.status(403).json({ message: 'Only event hosts or co-hosts can add guests.' });
      return;
    }

    const result = await bulkAddGuests(eventId, userId, guests);

    // The bulk function always succeeds and returns a summary.
    // There is no `!result.success` case to check here.
    res.status(200).json({
      message: result.summary,
      created: result.created,
      failed: result.failed,
    });

  } catch (error) {
    console.error('Bulk add guests error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;