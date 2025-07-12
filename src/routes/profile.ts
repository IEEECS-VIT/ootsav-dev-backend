import express, { Request, Response } from 'express';
import { getUser, updateUser } from '../services/userservice.js';

const router = express.Router();

router.patch('/update', async (req: Request, res: Response) => {
  // AUTH CHECK
  // Get the user's ID from the authentication token
  const userId = '1fc3a1f4-6d4d-48a6-8340-6e7d07d7ce46'

  const {name, dob, mobile_number, email, gender, profile_pic} = req.body
  if (!name && !dob && !mobile_number && !email && !gender && !profile_pic) {
    res.status(400).json({message: 'Nothing to change'})
    return
  }

  const user = await getUser(userId)
  if (!user) {
    res.status(404).json({message: 'User not found'})
    return
  }

  const {success, error, user: updatedUser} = await updateUser(userId, {name, dob, mobile_number, email, gender, profile_pic})

  if (success) {
    res.status(200).json(updatedUser)
  } else {
    res.status(500).json({message: error ?? 'Internal Server Error'})
  }
})

export default router