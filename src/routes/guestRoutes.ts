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
} from '../services/guestService';
import { verifyIdToken } from '../middleware/verifyIdToken';

const router = express.Router();

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
    console.error(error);
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

    // Check if user is host or co-host
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
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.get('/:eventId/groups', verifyIdToken, async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Check if user is host or co-host
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
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Get a specific guest group
router.get('/:eventId/groups/:groupId', verifyIdToken, async (req: Request, res: Response) => {
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
    console.error(error);
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
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Delete a guest group from an event (does not delete the group itself)
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
    console.error(error);
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
    console.error(error);
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
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});



export default router;