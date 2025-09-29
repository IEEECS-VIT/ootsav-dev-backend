import express, { Request, Response } from 'express';
import {
  setEventRsvpPreferences,
  getEventRsvpPreferences,
  getGroupRsvpPreferences
} from '../services/rsvpPreferencesService';
import { verifyIdToken } from '../middleware/verifyIdToken';

const router = express.Router();

// Set/Update RSVP preferences for an event (HOST/CO-HOST ONLY)
router.put('/:eventId/preferences', verifyIdToken, async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const userId = req.userId;
    
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const {
      rsvp_lock_date,
      collect_food,
      collect_alcohol,
      global_additional_details,
      group_preferences
    } = req.body;

    // Validation
    if (!rsvp_lock_date) {
      res.status(400).json({ message: 'RSVP lock date is required' });
      return;
    }

    if (collect_food === undefined || collect_alcohol === undefined) {
      res.status(400).json({ message: 'collect_food and collect_alcohol are required' });
      return;
    }

    const result = await setEventRsvpPreferences(eventId, userId, {
      rsvp_lock_date,
      collect_food,
      collect_alcohol,
      global_additional_details,
      group_preferences: group_preferences || []
    });

    if (!result.success) {
      res.status(400).json({ message: result.error });
      return;
    }

    res.status(201).json({
      message: result.message,
      preferences: result.preferences
    });
  } catch (error) {
    console.error('Set RSVP preferences error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Get RSVP preferences for an event (HOST/CO-HOST ONLY)  
router.get('/:eventId/preferences', verifyIdToken, async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const userId = req.userId;
    
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const result = await getEventRsvpPreferences(eventId, userId);

    if (!result.success) {
      if (result.error?.includes('Access denied') || result.error?.includes('Only event hosts')) {
        res.status(403).json({ message: result.error });
      } else if (result.error?.includes('not found') || result.error?.includes('No groups found')) {
        res.status(404).json({ message: result.error });
      } else {
        res.status(400).json({ message: result.error });
      }
      return;
    }

    res.status(200).json({
      globalSettings: result.globalSettings,
      groupPreferences: result.groupPreferences
    });
  } catch (error) {
    console.error('Get RSVP preferences error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Get RSVP preferences for a specific group (NO AUTH - PUBLIC)
router.get('/:eventId/groups/:groupId/preferences', async (req: Request, res: Response) => {
  try {
    const { eventId, groupId } = req.params;

    const result = await getGroupRsvpPreferences(eventId, groupId);

    if (!result.success) {
      if (result.error?.includes('not found')) {
        res.status(404).json({ message: result.error });
      } else {
        res.status(400).json({ message: result.error });
      }
      return;
    }

    res.status(200).json({
      preferences: result.preferences
    });
  } catch (error) {
    console.error('Get group RSVP preferences error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;