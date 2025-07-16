import express, { Request, Response } from 'express';
import { getUser, updateUser } from '../services/userservice';
import { verifyIdToken } from '../middleware/verifyIdToken';

const router = express.Router();

router.patch('/update', verifyIdToken, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    const { name, dob, email, gender, profile_pic } = req.body
    if (!name && !dob && !email && !gender && !profile_pic) {
      res.status(400).json({ message: 'Nothing to change' })
      return
    }
    const user = await getUser(userId)
    if (!user) {
      res.status(404).json({ message: 'User not found' })
      return
    }

    const { success, error, user: updatedUser } = await updateUser(userId, { name, dob, email, gender, profile_pic })

    if (success) {
      res.status(200).json(updatedUser)
    } else {
      res.status(500).json({ message: error ?? 'Internal Server Error' })
    }
  } catch (err) {
    res.status(500).json({ message: 'Internal Server Error', error: err instanceof Error ? err.message : err });
  }
})

router.get('/', verifyIdToken, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    const user = await getUser(userId);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ message: 'Internal Server Error', error: err instanceof Error ? err.message : err });
  }
})


export default router;