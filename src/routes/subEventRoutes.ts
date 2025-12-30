import express, { Request, Response } from 'express';
import {
  createSubEvent,
  getSubEvents,
  getSubEventsForUser,
  getSubEvent,
  updateSubEvent,
  deleteSubEvent,
  addGuestToSubEvent,
  removeGuestFromSubEvent,
  canManageSubEvent,
  canManageEventSubEvents,
  addGuestGroupToSubEvent,
  removeGuestGroupFromSubEvent,
  getSubEventGuestGroups
} from '../services/subEventService';
import { verifyIdToken } from '../middleware/verifyIdToken';
import { parseMultipartForm, uploadFilesToSupabase } from '../lib/fileUpload';

const router = express.Router({ mergeParams: true }); 

// Create a new sub-event
router.post('/', verifyIdToken, async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    
    const { fields, files } = await parseMultipartForm(req);
    
    const {
      title,
      location,
      address,
      start_date_time,
      end_date_time,
      invite_message
    } = fields;
    
    if (!title || !location || !address || !start_date_time || !end_date_time) {
      res.status(400).json({ message: 'Title, location, address, start_date_time, and end_date_time are required' });
      return;
    }
    
    let imageUrls: string[] = [];
    if (files && files.length > 0) {
      imageUrls = await uploadFilesToSupabase(files, 'subevent-images');
    }
    
    const image = imageUrls.length > 0 ? imageUrls[0] : (fields.image || '');

    const canManage = await canManageEventSubEvents(userId, eventId);
    if (!canManage) {
      res.status(403).json({ message: 'Only event hosts and co-hosts can create sub-events' });
      return;
    }

    const result = await createSubEvent(eventId, {
      title,
      location,
      address,
      start_date_time,
      end_date_time,
      invite_message,
      image
    });

    if (!result.success) {
      res.status(400).json({ message: result.error });
      return;
    }

    res.status(201).json({
      message: 'Sub-event created successfully',
      subEvent: result.subEvent
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Get all sub-events for an event (filtered by user role)
router.get('/', verifyIdToken, async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const result = await getSubEventsForUser(eventId, userId);

    if (!result.success) {
      res.status(400).json({ message: result.error });
      return;
    }

    res.status(200).json({
      subEvents: result.subEvents,
      role: result.role
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Get a specific sub-event
router.get('/:subEventId', verifyIdToken, async (req: Request, res: Response) => {
  try {
    const { eventId, subEventId } = req.params;
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Check if user can manage this sub-event
    // const canManage = await canManageSubEvent(userId, subEventId);
    // if (!canManage) {
    //   res.status(403).json({ message: 'Only event hosts and co-hosts can view sub-events' });
    //   return;
    // }

    const result = await getSubEvent(subEventId);

    if (!result.success) {
      res.status(404).json({ message: result.error });
      return;
    }

    res.status(200).json({
      subEvent: result.subEvent
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Update a sub-event
router.put('/:subEventId', verifyIdToken, async (req: Request, res: Response) => {
  try {
    const { eventId, subEventId } = req.params;
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    
    const { fields, files } = await parseMultipartForm(req);
    
    const {
      title,
      location,
      address,
      start_date_time,
      end_date_time,
      invite_message,
      guests
    } = fields;
    
    let imageUrls: string[] = [];
    if (files && files.length > 0) {
      imageUrls = await uploadFilesToSupabase(files, 'subevent-images');
    }
    
    const image = imageUrls.length > 0 ? imageUrls[0] : (fields.image || '');

    const canManage = await canManageSubEvent(userId, subEventId);
    if (!canManage) {
      res.status(403).json({ message: 'Only event hosts and co-hosts can update sub-events' });
      return;
    }

    const result = await updateSubEvent(subEventId, {
      title,
      location,
      address,
      start_date_time,
      end_date_time,
      invite_message,
      image,
            guests: guests ? guests.split(',') : [],
          });
      
    if (!result.success) {
      res.status(400).json({ message: result.error });
      return;
    }

    res.status(200).json({
      message: 'Sub-event updated successfully',
      subEvent: result.subEvent
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Delete a sub-event
router.delete('/:subEventId', verifyIdToken, async (req: Request, res: Response) => {
  try {
    const { eventId, subEventId } = req.params;
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Check if user can manage this sub-event
    const canManage = await canManageSubEvent(userId, subEventId);
    if (!canManage) {
      res.status(403).json({ message: 'Only event hosts and co-hosts can delete sub-events' });
      return;
    }

    const result = await deleteSubEvent(subEventId);

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

// Add guest to sub-event
router.post('/:subEventId/guests', verifyIdToken, async (req: Request, res: Response) => {
  try {
    const { eventId, subEventId } = req.params;
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    const { guestId } = req.body;

    if (!guestId) {
      res.status(400).json({ message: 'Guest ID is required' });
      return;
    }

    // Check if user can manage this sub-event
    const canManage = await canManageSubEvent(userId, subEventId);
    if (!canManage) {
      res.status(403).json({ message: 'Only event hosts and co-hosts can add guests to sub-events' });
      return;
    }

    const result = await addGuestToSubEvent(subEventId, guestId);

    if (!result.success) {
      res.status(400).json({ message: result.error });
      return;
    }

    res.status(200).json({
      message: result.message,
      subEvent: result.subEvent
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Remove guest from sub-event
router.delete('/:subEventId/guests/:guestId', verifyIdToken, async (req: Request, res: Response) => {
  try {
    const { eventId, subEventId, guestId } = req.params;
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Check if user can manage this sub-event
    const canManage = await canManageSubEvent(userId, subEventId);
    if (!canManage) {
      res.status(403).json({ message: 'Only event hosts and co-hosts can remove guests from sub-events' });
      return;
    }

    const result = await removeGuestFromSubEvent(subEventId, guestId);

    if (!result.success) {
      res.status(400).json({ message: result.error });
      return;
    }

    res.status(200).json({
      message: result.message,
      subEvent: result.subEvent
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Get guest groups for a sub-event
router.get('/:subEventId/guest-groups', verifyIdToken, async (req: Request, res: Response) => {
  try {
    const { eventId, subEventId } = req.params;
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Check if user can manage this sub-event
    const canManage = await canManageSubEvent(userId, subEventId);
    if (!canManage) {
      res.status(403).json({ message: 'Only event hosts and co-hosts can view sub-event guest groups' });
      return;
    }

    const result = await getSubEventGuestGroups(subEventId);

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

// Add guest group to sub-event
router.post('/:subEventId/guest-groups', verifyIdToken, async (req: Request, res: Response) => {
  try {
    const { eventId, subEventId } = req.params;
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    const { guestGroupId, guestGroupIds } = req.body;

    // Support both single guestGroupId and multiple guestGroupIds
    let groupIds: string[] = [];
    if (guestGroupId) {
      groupIds = [guestGroupId];
    } else if (guestGroupIds && Array.isArray(guestGroupIds)) {
      groupIds = guestGroupIds;
    } else {
      res.status(400).json({ message: 'Either guestGroupId or guestGroupIds array is required' });
      return;
    }

    if (groupIds.length === 0) {
      res.status(400).json({ message: 'At least one guest group ID is required' });
      return;
    }

    // Check if user can manage this sub-event
    const canManage = await canManageSubEvent(userId, subEventId);
    if (!canManage) {
      res.status(403).json({ message: 'Only event hosts and co-hosts can add guest groups to sub-events' });
      return;
    }

    // Add all guest groups
    const results = await Promise.all(
      groupIds.map(groupId => addGuestGroupToSubEvent(subEventId, groupId))
    );

    // Check if any failed
    const failures = results.filter(r => !r.success);
    const successes = results.filter(r => r.success);

    if (failures.length > 0 && successes.length === 0) {
      res.status(400).json({ 
        message: 'Failed to add all guest groups',
        errors: failures.map(f => f.error)
      });
      return;
    }

    res.status(200).json({
      message: `Successfully added ${successes.length} guest group(s) to sub-event`,
      addedCount: successes.length,
      failedCount: failures.length,
      results: results
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Remove guest group from sub-event
router.delete('/:subEventId/guest-groups/:guestGroupId', verifyIdToken, async (req: Request, res: Response) => {
  try {
    const { eventId, subEventId, guestGroupId } = req.params;
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Check if user can manage this sub-event
    const canManage = await canManageSubEvent(userId, subEventId);
    if (!canManage) {
      res.status(403).json({ message: 'Only event hosts and co-hosts can remove guest groups from sub-events' });
      return;
    }

    const result = await removeGuestGroupFromSubEvent(subEventId, guestGroupId);

    if (!result.success) {
      res.status(400).json({ message: result.error });
      return;
    }

    res.status(200).json({
      message: result.message,
      subEvent: result.subEvent
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;
