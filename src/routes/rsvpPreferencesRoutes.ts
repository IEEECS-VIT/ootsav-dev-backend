import express, { Request, Response } from 'express';
import {
  setEventRsvpPreferences,
  getRsvpPreferencesForGroup,
  getEventRsvpPreferences,
  updateEventRsvpPreferences,
  deleteEventRsvpPreferences
} from '../services/rsvpPreferencesService';
import { verifyIdToken } from '../middleware/verifyIdToken';

const router = express.Router();

// Set RSVP preferences for an event (HOST/CO-HOST ONLY)
router.post('/:eventId/preferences', verifyIdToken, async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const userId = req.userId;
    
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const {
      rsvp_lock_date,
      collect_attendance,
      collect_guest_count,
      collect_food,
      collect_alcohol,
      additional_notes,
      group_preferences
    } = req.body;

    // Validation
    if (!rsvp_lock_date) {
      res.status(400).json({ message: 'RSVP lock date is required' });
      return;
    }

    if (collect_attendance === undefined || collect_guest_count === undefined) {
      res.status(400).json({ message: 'collect_attendance and collect_guest_count are required' });
      return;
    }

    const result = await setEventRsvpPreferences(eventId, userId, {
      rsvp_lock_date,
      collect_attendance,
      collect_guest_count,
      collect_food: collect_food || false,
      collect_alcohol: collect_alcohol || false,
      additional_notes,
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
      } else if (result.error?.includes('not found') || result.error?.includes('No RSVP preferences')) {
        res.status(404).json({ message: result.error });
      } else {
        res.status(400).json({ message: result.error });
      }
      return;
    }

    res.status(200).json({
      globalPreferences: result.globalPreferences,
      groupPreferences: result.groupPreferences,
      allPreferences: result.allPreferences
    });
  } catch (error) {
    console.error('Get RSVP preferences error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Update RSVP preferences for an event (HOST/CO-HOST ONLY)
router.patch('/:eventId/preferences', verifyIdToken, async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const userId = req.userId;
    
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const result = await updateEventRsvpPreferences(eventId, userId, req.body);

    if (!result.success) {
      if (result.error?.includes('Access denied') || result.error?.includes('Only event hosts')) {
        res.status(403).json({ message: result.error });
      } else {
        res.status(400).json({ message: result.error });
      }
      return;
    }

    res.status(200).json({ message: result.message });
  } catch (error) {
    console.error('Update RSVP preferences error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Delete RSVP preferences for an event (HOST/CO-HOST ONLY)
router.delete('/:eventId/preferences', verifyIdToken, async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const userId = req.userId;
    
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const result = await deleteEventRsvpPreferences(eventId, userId);

    if (!result.success) {
      if (result.error?.includes('Access denied') || result.error?.includes('Only event hosts')) {
        res.status(403).json({ message: result.error });
      } else {
        res.status(400).json({ message: result.error });
      }
      return;
    }

    res.status(200).json({ message: result.message });
  } catch (error) {
    console.error('Delete RSVP preferences error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;