import express, { Request, Response } from 'express';
import {
  createGuestGroup,
  getGuestGroups,
  getGuestGroup,
  updateGuestGroup,
  deleteGuestGroup,
  addMemberToGroup,
  removeMemberFromGroup,
  isEventHostOrCoHost
} from '../services/guestService';
import { verifyIdToken } from '../middleware/verifyIdToken';

const router = express.Router();

// Create a new guest group
router.post('/:eventId/groups', verifyIdToken, async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const userId = req.userId;
    const { name, members } = req.body;

    if (!name) {
      res.status(400).json({ message: 'Group name is required' });
      return;
    }

    // Check if user is host or co-host
    const isAuthorized = await isEventHostOrCoHost(userId, eventId);
    if (!isAuthorized) {
      res.status(403).json({ message: 'Only event hosts and co-hosts can create guest groups' });
      return;
    }

    const result = await createGuestGroup(eventId, { name, members });

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

// Get all guest groups for an event
router.get('/:eventId/groups', verifyIdToken, async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const userId = req.userId;

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
router.put('/:eventId/groups/:groupId', verifyIdToken, async (req: Request, res: Response) => {
  try {
    const { eventId, groupId } = req.params;
    const userId = req.userId;
    const { name, members } = req.body;

    // Check if user is host or co-host
    const isAuthorized = await isEventHostOrCoHost(userId, eventId);
    if (!isAuthorized) {
      res.status(403).json({ message: 'Only event hosts and co-hosts can update guest groups' });
      return;
    }

    const result = await updateGuestGroup(groupId, { name, members });

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

// Delete a guest group
router.delete('/:eventId/groups/:groupId', verifyIdToken, async (req: Request, res: Response) => {
  try {
    const { eventId, groupId } = req.params;
    const userId = req.userId;

    // Check if user is host or co-host
    const isAuthorized = await isEventHostOrCoHost(userId, eventId);
    if (!isAuthorized) {
      res.status(403).json({ message: 'Only event hosts and co-hosts can delete guest groups' });
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

// Add member to guest group by phone number
router.post('/:eventId/groups/:groupId/members', verifyIdToken, async (req: Request, res: Response) => {
  try {
    const { eventId, groupId } = req.params;
    const userId = req.userId;
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      res.status(400).json({ message: 'Phone number is required' });
      return;
    }

    // Check if user is host or co-host
    const isAuthorized = await isEventHostOrCoHost(userId, eventId);
    if (!isAuthorized) {
      res.status(403).json({ message: 'Only event hosts and co-hosts can add members to guest groups' });
      return;
    }

    const result = await addMemberToGroup(groupId, eventId, phoneNumber);

    if (!result.success) {
      res.status(400).json({ message: result.error });
      return;
    }

    res.status(200).json({
      message: result.message,
      guest: result.guest
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Remove member from guest group by phone number
router.delete('/:eventId/groups/:groupId/members', verifyIdToken, async (req: Request, res: Response) => {
  try {
    const { eventId, groupId } = req.params;
    const userId = req.userId;
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      res.status(400).json({ message: 'Phone number is required' });
      return;
    }

    // Check if user is host or co-host
    const isAuthorized = await isEventHostOrCoHost(userId, eventId);
    if (!isAuthorized) {
      res.status(403).json({ message: 'Only event hosts and co-hosts can remove members from guest groups' });
      return;
    }

    const result = await removeMemberFromGroup(groupId, phoneNumber);

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
