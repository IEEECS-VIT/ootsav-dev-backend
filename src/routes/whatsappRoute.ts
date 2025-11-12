import express, { Request, Response } from 'express';
import { verifyIdToken } from '../middleware/verifyIdToken';
import { sendWhatsappInviteWithTwilio, sendGroupWhatsappMessage } from '../services/inviteService';
import multer from 'multer';
import xlsx from 'xlsx';
import { uploadFile } from '../services/supabaseService';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Helper function to add guest to group with pending RSVP
const addGuestToGroup = async (
    eventId: string,
    groupId: string,
    guestName: string,
    phoneNo: string
) => {
    try {
        // Import Prisma client here to avoid circular dependencies
        const { PrismaClient } = await import('@prisma/client');
        const prisma = new PrismaClient();

        // Check if guest already exists in this group for this event
        const existingGuest = await prisma.guest.findFirst({
            where: {
                event_id: eventId,
                group_id: groupId,
                phone_no: phoneNo
            }
        });

        if (existingGuest) {
            return {
                success: false,
                error: 'Guest already exists in this group for this event'
            };
        }

        // Add new guest to the group with pending RSVP status
        const newGuest = await prisma.guest.create({
            data: {
                user_id: null, // Unlinked for now, will be linked when they create account
                event_id: eventId,
                group_id: groupId,
                name: guestName,
                phone_no: phoneNo,
                rsvp: 'no_response', // Pending status
                count: 1,
                email: null // Will be filled when they submit RSVP
            }
        });

        await prisma.$disconnect();

        return {
            success: true,
            guest: newGuest
        };
    } catch (error: any) {
        console.error('Error adding guest to group:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

// Endpoint to send a single WhatsApp invite via Twilio
router.post('/send-invite', verifyIdToken, async (req: Request, res: Response) => {
    console.log('[/whatsapp/send-invite] Received request');
    const userId = req.userId;
    const { eventId, groupId, name, phone_no, invites } = req.body;

    console.log('[/whatsapp/send-invite] Request body:', req.body);
    console.log('[/whatsapp/send-invite] Authenticated userId:', userId);

    if (!userId) {
        console.log('[/whatsapp/send-invite] Unauthorized: No userId');
        return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!eventId || !groupId) {
        console.log('[/whatsapp/send-invite] Bad Request: Missing eventId or groupId');
        return res.status(400).json({ message: 'Missing required fields: eventId, groupId' });
    }

    // Support multiple formats:
    // 1. New format: invites array with {name, phone_no} objects
    // 2. Legacy format: single name and phone_no (string)
    // 3. Legacy format: single name and multiple phone_no (array)
    let invitesList: Array<{ name: string; phone_no: string }> = [];

    if (invites && Array.isArray(invites)) {
        // New format: array of {name, phone_no} objects
        console.log('[/whatsapp/send-invite] Using invites array format');
        invitesList = invites.filter((invite: any) => invite.name && invite.phone_no);
        if (invitesList.length === 0) {
            console.log('[/whatsapp/send-invite] Bad Request: invites array is empty or invalid');
            return res.status(400).json({ message: 'invites array must contain objects with name and phone_no' });
        }
    } else if (name && phone_no) {
        // Legacy format: single name with one or more phone numbers
        console.log('[/whatsapp/send-invite] Using legacy format with name and phone_no');
        if (typeof phone_no === 'string') {
            invitesList = [{ name, phone_no }];
        } else if (Array.isArray(phone_no)) {
            invitesList = phone_no.map((phone: string) => ({ name, phone_no: phone }));
        } else {
            console.log('[/whatsapp/send-invite] Bad Request: phone_no must be a string or array');
            return res.status(400).json({ message: 'phone_no must be a string or an array of strings' });
        }
    } else {
        console.log('[/whatsapp/send-invite] Bad Request: No valid invite data provided');
        return res.status(400).json({ message: 'Either provide invites array [{name, phone_no}] or name and phone_no fields' });
    }

    if (invitesList.length === 0) {
        console.log('[/whatsapp/send-invite] Bad Request: No invites to send');
        return res.status(400).json({ message: 'At least one invite is required' });
    }

    try {
        console.log('[/whatsapp/send-invite] Sending invites to', invitesList.length, 'recipient(s)');
        console.log('[/whatsapp/send-invite] Invites list:', JSON.stringify(invitesList));

        const results = {
            sent: [] as any[],
            failed: [] as any[],
        };

        // Add each recipient to the group first, then send invite
        for (const invite of invitesList) {
            console.log('[/whatsapp/send-invite] Processing:', invite);
            
            try {
                // First, add the person to the group with pending RSVP status
                const addToGroupResult = await addGuestToGroup(
                    eventId,
                    groupId,
                    invite.name,
                    String(invite.phone_no)
                );

                if (addToGroupResult.success) {
                    console.log('[/whatsapp/send-invite] Guest added to group:', invite.name);
                    
                    // Then send WhatsApp invite
                    const whatsappResult = await sendWhatsappInviteWithTwilio(
                        userId,
                        eventId,
                        groupId,
                        invite.name,
                        String(invite.phone_no)
                    );

                    if (whatsappResult.success) {
                        results.sent.push({ 
                            name: invite.name, 
                            phone_no: invite.phone_no,
                            addedToGroup: true,
                            rsvpStatus: 'no_response'
                        });
                        console.log('[/whatsapp/send-invite] WhatsApp sent successfully to:', invite.name);
                    } else {
                        // WhatsApp failed but user was added to group
                        results.failed.push({ 
                            name: invite.name, 
                            phone_no: invite.phone_no, 
                            error: `Added to group but WhatsApp failed: ${whatsappResult.error}`,
                            addedToGroup: true
                        });
                        console.log('[/whatsapp/send-invite] WhatsApp failed for:', invite.name, whatsappResult.error);
                    }
                } else {
                    // Failed to add to group - check if guest already exists
                    console.log('[/whatsapp/send-invite] Failed to add to group:', invite.name, addToGroupResult.error);
                    
                    if (addToGroupResult.error?.includes('already exists')) {
                        // Guest already exists, still try to send WhatsApp
                        const whatsappResult = await sendWhatsappInviteWithTwilio(
                            userId,
                            eventId,
                            groupId,
                            invite.name,
                            String(invite.phone_no)
                        );
                        
                        if (whatsappResult.success) {
                            results.sent.push({ 
                                name: invite.name, 
                                phone_no: invite.phone_no,
                                addedToGroup: false,
                                note: 'Guest already in group'
                            });
                        } else {
                            results.failed.push({ 
                                name: invite.name, 
                                phone_no: invite.phone_no, 
                                error: `Guest exists in group, WhatsApp also failed: ${whatsappResult.error}`,
                                addedToGroup: false
                            });
                        }
                    } else {
                        // Complete failure
                        results.failed.push({ 
                            name: invite.name, 
                            phone_no: invite.phone_no, 
                            error: `Failed to add to group: ${addToGroupResult.error}`,
                            addedToGroup: false
                        });
                    }
                }
            } catch (error: any) {
                console.log('[/whatsapp/send-invite] Unexpected error for:', invite.name, error.message);
                results.failed.push({ 
                    name: invite.name, 
                    phone_no: invite.phone_no, 
                    error: error.message,
                    addedToGroup: false
                });
            }
        }

        console.log('[/whatsapp/send-invite] Results:', results);

        // Return success if at least one invite was sent
        if (results.sent.length > 0) {
            res.status(200).json({
                message: `Successfully sent ${results.sent.length} out of ${invitesList.length} invite(s)`,
                ...results
            });
        } else {
            res.status(500).json({
                message: 'Failed to send all invites',
                ...results
            });
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
                try {
                    // Add guest to group with pending RSVP status (no WhatsApp sending)
                    const addToGroupResult = await addGuestToGroup(eventId, groupId, guest.name, String(guest.phone_no));
                    
                    if (addToGroupResult.success) {
                        results.sent.push({ 
                            name: guest.name, 
                            phone_no: guest.phone_no,
                            addedToGroup: true,
                            rsvpStatus: 'no_response'
                        });
                    } else if (addToGroupResult.error?.includes('already exists')) {
                        results.sent.push({ 
                            name: guest.name, 
                            phone_no: guest.phone_no,
                            addedToGroup: false,
                            note: 'Guest already in group',
                            rsvpStatus: 'no_response'
                        });
                    } else {
                        results.failed.push({ 
                            name: guest.name, 
                            phone_no: guest.phone_no, 
                            error: `Failed to add to group: ${addToGroupResult.error}`,
                            addedToGroup: false
                        });
                    }
                } catch (error: any) {
                    results.failed.push({ 
                        name: guest.name, 
                        phone_no: guest.phone_no, 
                        error: error.message,
                        addedToGroup: false
                    });
                }
            } else {
                results.failed.push({ ...guest, error: 'Missing name or phone_no' });
            }
        }

        res.status(200).json({
            message: 'Bulk guest addition process completed.',
            ...results
        });

    } catch (error: any) {
        res.status(500).json({ message: 'Failed to process bulk guest addition', error: error.message });
    }
});

// Endpoint to send a message to all guests in a group
router.post('/send-group-message', verifyIdToken, upload.single('image'), async (req: Request, res: Response) => {
    const userId = req.userId;
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const { eventId, groupId, title, body } = req.body;
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

        const result = await sendGroupWhatsappMessage(userId, eventId, groupId, title, body, mediaUrl);

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