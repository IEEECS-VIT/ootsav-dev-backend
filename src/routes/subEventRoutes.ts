import express, { Request, Response } from 'express';
import {
  createSubEvent,
  getSubEvents,
  getSubEvent,
  updateSubEvent,
  deleteSubEvent,
  addGuestToSubEvent,
  removeGuestFromSubEvent,
  canManageSubEvent,
  canManageEventSubEvents
} from '../services/subEventService';
import { verifyIdToken } from '../middleware/verifyIdToken';
import { parseMultipartForm, uploadFilesToSupabase } from '../lib/fileUpload';

const router = express.Router();

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
      invite_message,
      guests
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
      image,
      guests
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

// Get all sub-events for an event
router.get('/', verifyIdToken, async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Check if user can manage sub-events for this event
    const canManage = await canManageEventSubEvents(userId, eventId);
    if (!canManage) {
      res.status(403).json({ message: 'Only event hosts and co-hosts can view sub-events' });
      return;
    }

    const result = await getSubEvents(eventId);

    if (!result.success) {
      res.status(400).json({ message: result.error });
      return;
    }

    res.status(200).json({
      subEvents: result.subEvents
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
    const canManage = await canManageSubEvent(userId, subEventId);
    if (!canManage) {
      res.status(403).json({ message: 'Only event hosts and co-hosts can view sub-events' });
      return;
    }

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
      guests
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

export default router;
