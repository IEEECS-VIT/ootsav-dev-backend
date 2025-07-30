import express, { Request, Response } from 'express';
import { getUser, getUserByPhoneNumber } from '../services/userService';
import { 
  getEvent,
  createEvent, 
  addCohost, 
  removeCohost,
  updateEvent,
  deleteEvent,
  addWeddingDetails,
  addBirthdayDetails,
  addHousePartyDetails,
  addTravelDetails
} from '../services/eventService';
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
    const {eventId, phoneNumber} = req.body
    
    if (!eventId || !phoneNumber) {
      res.status(401).json({message: 'Missing required fields'})
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
  
    const { success, event, error } = await removeCohost(eventId, cohost.id);
  
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

// Add Wedding Details
router.post('/add-wedding-details', verifyIdToken, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    const { eventId, bride_name, groom_name, bride_details, groom_details, bride_groom_images, hashtag } = req.body;
    
    if (!eventId || !bride_name || !groom_name) {
      res.status(400).json({ message: 'Missing required fields: eventId, bride_name, groom_name' });
      return;
    }
  
    const user = await getUser(userId);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
  
    const { success, weddingDetails, error } = await addWeddingDetails(eventId, {
      bride_name,
      groom_name,
      bride_details,
      groom_details,
      bride_groom_images,
      hashtag
    });
  
    if (success) {
      res.status(200).json({ message: 'Wedding details added successfully', weddingDetails });
    } else {
      res.status(500).json({ message: error ?? 'Internal Server Error' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Add Birthday Details
router.post('/add-birthday-details', verifyIdToken, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    const { eventId, person_image, hashtag } = req.body;
    
    if (!eventId) {
      res.status(400).json({ message: 'Missing required field: eventId' });
      return;
    }
  
    const user = await getUser(userId);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
  
    const { success, birthdayDetails, error } = await addBirthdayDetails(eventId, {
      person_image,
      hashtag
    });
  
    if (success) {
      res.status(200).json({ message: 'Birthday details added successfully', birthdayDetails });
    } else {
      res.status(500).json({ message: error ?? 'Internal Server Error' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Add House Party Details
router.post('/add-houseparty-details', verifyIdToken, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    const { eventId, cost, rules, terms, tags } = req.body;
    
    if (!eventId) {
      res.status(400).json({ message: 'Missing required field: eventId' });
      return;
    }
  
    const user = await getUser(userId);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
  
    const { success, housePartyDetails, error } = await addHousePartyDetails(eventId, {
      cost,
      rules,
      terms,
      tags
    });
  
    if (success) {
      res.status(200).json({ message: 'House party details added successfully', housePartyDetails });
    } else {
      res.status(500).json({ message: error ?? 'Internal Server Error' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Add Travel Details
router.post('/add-travel-details', verifyIdToken, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    const { eventId, cost, terms, itinerary_included, itinerary_excluded, rules, tags } = req.body;
    
    if (!eventId) {
      res.status(400).json({ message: 'Missing required field: eventId' });
      return;
    }
  
    const user = await getUser(userId);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
  
    const { success, travelDetails, error } = await addTravelDetails(eventId, {
      cost,
      terms,
      itinerary_included,
      itinerary_excluded,
      rules,
      tags
    });
  
    if (success) {
      res.status(200).json({ message: 'Travel details added successfully', travelDetails });
    } else {
      res.status(500).json({ message: error ?? 'Internal Server Error' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Delete Event
router.delete('/:eventId', verifyIdToken, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    const { eventId } = req.params;
    
    if (!eventId) {
      res.status(400).json({ message: 'Event ID is required' });
      return;
    }
    
    const user = await getUser(userId);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    
    const event = await getEvent(eventId);
    if (!event) {
      res.status(404).json({ message: 'Event not found' });
      return;
    }
    
    if (event.hostId !== userId) {
      res.status(403).json({ message: 'Only the host can delete this event' });
      return;
    }
    
    const { success, error } = await deleteEvent(eventId);
    
    if (success) {
      res.status(200).json({ message: 'Event deleted successfully' });
    } else {
      res.status(500).json({ message: error ?? 'Internal Server Error' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router