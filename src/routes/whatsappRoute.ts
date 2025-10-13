import express, { Request, Response } from 'express';
import { verifyIdToken } from '../middleware/verifyIdToken';
import { whatsAppManager } from '../services/baileysService';

const router = express.Router();

// Endpoint to initiate the connection process
router.post('/connect', verifyIdToken, async (req: Request, res: Response) => {
    const userId = req.userId;
    const { phoneNumber } = req.body;

    if (!userId || !phoneNumber) {
        return res.status(400).json({ message: 'UserId and phoneNumber are required.' });
    }

    try {
        // This will start the process. The frontend will then poll the /status endpoint.
        await whatsAppManager.startClient(userId, phoneNumber);
        res.status(202).json({ message: 'Pairing process initiated. Please poll the /status endpoint.' });
    } catch (error: any) {
        res.status(500).json({ message: 'Failed to start connection', error: error.message });
    }
});

// Long polling endpoint for status updates
router.get('/status', verifyIdToken, (req: Request, res: Response) => {
    const userId = req.userId;
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    // Set a timeout for the request (e.g., 30 seconds) to avoid holding connections indefinitely
    req.setTimeout(30000, () => {
        res.status(200).json({ status: 'PENDING', message: 'Timeout, please poll again.' });
        // Clean up the listener on timeout
        whatsAppManager.removeAllListeners(`update_${userId}`);
    });

    const currentState = whatsAppManager.getState(userId);

    const onUpdate = (newState: any) => {
        res.status(200).json(newState);
        // Clean up the listener once we've sent a response
        whatsAppManager.removeListener(`update_${userId}`, onUpdate);
    };

    // If the state has already changed (e.g., code is ready instantly), respond immediately.
    // Otherwise, listen for the next update.
    if (currentState.status !== 'DISCONNECTED') {
        return res.status(200).json(currentState);
    } else {
        whatsAppManager.once(`update_${userId}`, onUpdate);
    }

    // Clean up listener if the client closes the connection prematurely
    res.on('close', () => {
        whatsAppManager.removeListener(`update_${userId}`, onUpdate);
    });
});

export default router;