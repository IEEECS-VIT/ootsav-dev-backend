import express, { Request, Response } from 'express';
import { getUser } from '../services/userService';
import { 
  getEvent,
  createEvent, 
  addCohost, 
  removeCohost,
  updateEvent, 
} from '../services/eventService';
import { getUserByPhoneNumber } from '../services/userService';
import { verifyIdToken } from '../middleware/verifyIdToken';

const router = express.Router();

router.get('/:eventId', verifyIdToken, async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const event = await getEvent(eventId);
    
    if (!event) {
      res.status(404).json({ message: 'Event not found' });
      return;
    }
    
    res.status(200).json(event);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Create Event
router.post('/create', verifyIdToken, async (req: Request, res: Response) => {
  try {
    const userId = req.userId
    const {title, type, start_date_time, end_date_time, location, address, message, image} = req.body
    
    if (!title || !type || !start_date_time || (!location && !address)) {
      res.status(401).json({message: 'Missing required fields'})
      return
    }
    
    const user = await getUser(userId)
    if (!user) {
      res.status(404).json({message: 'User not found'})
      return
    }
  
    const { success, event, error } = await createEvent({
      title,
      type,
      start_date_time,
      end_date_time,
      location,
      address,
      message,
      image,
      hostId: userId
    });
  
    if (success) {
      res.status(200).json({message: 'Event created successfully', event})
    } else {
      res.status(500).json({message: error ?? 'Internal Server Error'})
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
})

router.patch('/update', verifyIdToken, async (req: Request, res: Response) => {
  try {
    const userId = req.userId
  
    const {eventId, title, type, start_date_time, end_date_time, location, address, message} = req.body
    if (!eventId) {
      res.status(404).json({message: 'No event Id provided'})
    }
  
    if (!title && !type && !start_date_time && !end_date_time && !location && !address && !message) {
      res.status(400).json({message: 'Nothing to change'})
      return
    }
  
    const user = await getUser(userId)
    if (!user) {
      res.status(404).json({message: 'User not found'})
      return
    }
  
    const {success, error, event} = await updateEvent(eventId, {title, type, start_date_time, end_date_time, location, address, message})
  
    if (success) {
      res.status(200).json(event)
    } else {
      res.status(500).json({message: error ?? 'Internal Server Error'})
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
})

// Add Cohost
router.patch('/cohost/add', verifyIdToken, async (req: Request, res: Response) => {
  try {
    const userId = req.userId
    const {eventId, phoneNumber} = req.body
    
    if (!eventId || !phoneNumber) {
      res.status(401).json({message: 'Bad request(body is missing one or both parameters)'})
      return
    }
  
    const user = await getUser(userId)
    if (!user) {
      res.status(404).json({message: 'User not found'})
      return
    }
  
    const cohost = await getUserByPhoneNumber(phoneNumber)
    if (!cohost) {
      res.status(404).json({message: 'Cohost not found'})
      return
    }
  
    const { success, event, error } = await addCohost(eventId, cohost.id);
  
    if (success) {
      res.status(200).json({message: 'Cohost added successfully', event})
    } else {
      res.status(500).json({message: error ?? 'Internal Server Error'})
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
})

// Remove Cohost
router.patch('/cohost/remove', verifyIdToken, async (req: Request, res: Response) => {
  try {
    const userId = req.userId
    const {eventId, cohostId} = req.body
    
    if (!eventId || !cohostId) {
      res.status(401).json({message: 'Missing required fields'})
      return
    }
  
    const user = await getUser(userId)
    if (!user) {
      res.status(404).json({message: 'User not found'})
      return
    }
  
    const { success, event, error } = await removeCohost(eventId, cohostId);
  
    if (success) {
      res.status(200).json({message: 'Cohost removed successfully', event})
    } else {
      res.status(500).json({message: error ?? 'Internal Server Error'})
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
})

export default router