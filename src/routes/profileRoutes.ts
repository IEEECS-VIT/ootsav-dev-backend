import express, { Request, Response } from 'express';
import { getUser, updateUser } from '../services/userService';
import { verifyIdToken } from '../middleware/verifyIdToken';
import { parseMultipartForm, uploadFilesToSupabase } from '../lib/fileUpload';
import { deleteFile } from '../services/supabaseService';

const router = express.Router();

router.patch('/update', verifyIdToken, async (req: Request, res: Response) => {
  try {
    const { fields, files } = await parseMultipartForm(req);
    
    const fileUrls = await uploadFilesToSupabase(files, 'profile-pics');
    
    const profilePicUrl = fileUrls.length > 0 ? fileUrls[0] : fields.profile_pic || '';
    
    const hasDataToUpdate = Object.keys(fields).length > 0 || fileUrls.length > 0;
    if (!hasDataToUpdate) {
      res.status(400).json({ message: 'Nothing to change' });
      return;
    }
    
    const userId = req.userId;
    const user = await getUser(userId);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    
    const oldProfilePicUrl = user.profile_pic;
    
    const updateFields: any = {};
    if (fields.name) updateFields.name = fields.name;
    if (fields.dob) updateFields.dob = fields.dob;
    if (fields.email) updateFields.email = fields.email;
    if (fields.gender) updateFields.gender = fields.gender;
    if (fields.preferred_language) updateFields.preferred_language = fields.preferred_language;
    if (profilePicUrl) updateFields.profile_pic = profilePicUrl;
    if (fields.profile_pic === '') updateFields.profile_pic = '';
    
    const { success, error, user: updatedUser } = await updateUser(userId, updateFields);
    
    if (success) {
      if (profilePicUrl && oldProfilePicUrl && oldProfilePicUrl !== profilePicUrl) {
        try {
          const urlParts = oldProfilePicUrl.split('/');
          const fileName = urlParts[urlParts.length - 1];
          
          await deleteFile(fileName, 'profile-pics');
        } catch (deleteError) {
          console.error('Error deleting old profile picture:', deleteError);
        }
      }
      res.status(200).json(updatedUser);
    } else {
      res.status(500).json({ message: error ?? 'Internal Server Error' });
    }
  } catch (err) {
    res.status(500).json({ message: 'Internal Server Error', error: err instanceof Error ? err.message : err });
  }
});

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