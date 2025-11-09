import express, { Request, Response } from 'express';
import { verifyIdToken } from '../middleware/verifyIdToken';
import { sendWhatsappInviteWithTwilio, sendGroupWhatsappMessage } from '../services/inviteService';
import multer from 'multer';
import xlsx from 'xlsx';
import { uploadFile } from '../services/supabaseService';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Endpoint to send a single WhatsApp invite via Twilio
router.post('/send-invite', verifyIdToken, async (req: Request, res: Response) => {
    console.log('[/whatsapp/send-invite] Received request');
    const userId = req.userId;
    const { eventId, groupId, name, phone_no } = req.body;

    console.log('[/whatsapp/send-invite] Request body:', req.body);
    console.log('[/whatsapp/send-invite] Authenticated userId:', userId);

    if (!userId) {
        console.log('[/whatsapp/send-invite] Unauthorized: No userId');
        return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!eventId || !groupId || !name || !phone_no) {
        console.log('[/whatsapp/send-invite] Bad Request: Missing required fields');
        return res.status(400).json({ message: 'Missing required fields: eventId, groupId, name, phone_no' });
    }

    try {
        console.log('[/whatsapp/send-invite] Calling sendWhatsappInviteWithTwilio service');
        const result = await sendWhatsappInviteWithTwilio(userId, eventId, groupId, name, phone_no);
        console.log('[/whatsapp/send-invite] Service response:', result);
        if (result.success) {
            res.status(200).json({ message: 'Invite sent successfully.' });
        } else {
            res.status(500).json({ message: 'Failed to send invite', error: result.error });
        }
    } catch (error: any) {
        console.error('[/whatsapp/send-invite] An unexpected error occurred:', error);
        res.status(500).json({ message: 'An unexpected error occurred', error: error.message });
    }
});

// Endpoint to send bulk WhatsApp invites via Twilio from an Excel file
router.post('/send-bulk-invites', verifyIdToken, upload.single('file'), async (req: Request, res: Response) => {
    const userId = req.userId;
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded.' });
    }

    const { eventId, groupId } = req.body;
    if (!eventId || !groupId) {
        return res.status(400).json({ message: 'Missing required fields: eventId, groupId' });
    }

    try {
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const guests: { name: string; phone_no: string }[] = xlsx.utils.sheet_to_json(worksheet);

        if (!guests.length) {
            return res.status(400).json({ message: 'The uploaded file is empty or in the wrong format.' });
        }

        const results = {
            sent: [] as any[],
            failed: [] as any[],
        };

        for (const guest of guests) {
            if (guest.name && guest.phone_no) {
                const result = await sendWhatsappInviteWithTwilio(userId, eventId, groupId, guest.name, String(guest.phone_no));
                if (result.success) {
                    results.sent.push({ name: guest.name, phone_no: guest.phone_no });
                } else {
                    results.failed.push({ name: guest.name, phone_no: guest.phone_no, error: result.error });
                }
            } else {
                results.failed.push({ ...guest, error: 'Missing name or phone_no' });
            }
        }

        res.status(200).json({
            message: 'Bulk invite process completed.',
            ...results
        });

    } catch (error: any) {
        res.status(500).json({ message: 'Failed to process bulk invites', error: error.message });
    }
});

// Endpoint to send a message to all guests in a group
router.post('/send-group-message', verifyIdToken, upload.single('image'), async (req: Request, res: Response) => {
    const userId = req.userId;
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const { eventId, groupId, body } = req.body;
    if (!eventId || !groupId || !body) {
        return res.status(400).json({ message: 'Missing required fields: eventId, groupId, body' });
    }

    let mediaUrl: string | undefined = undefined;

    try {
        if (req.file) {
            const fileName = `${Date.now()}-${req.file.originalname}`;
            const uploadedUrl = await uploadFile(req.file.buffer, fileName, 'whatsapp-media', req.file.mimetype);
            if (uploadedUrl) {
                mediaUrl = uploadedUrl;
            } else {
                return res.status(500).json({ message: 'Failed to upload image.' });
            }
        }

        const result = await sendGroupWhatsappMessage(userId, eventId, groupId, body, mediaUrl);

        if (result.success) {
            res.status(200).json({ message: 'Group message sent successfully.', ...result.results });
        } else {
            res.status(500).json({ message: 'Failed to send group message', error: result.error });
        }
    } catch (error: any) {
        res.status(500).json({ message: 'An unexpected error occurred', error: error.message });
    }
});


export default router;