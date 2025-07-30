import express, {Request, Response} from 'express';
import { upsertRSVP, cancelRSVP, getRSVPStatus, listUserRSVPs } from '../services/rsvpService';
import { verifyIdToken } from '../middleware/verifyIdToken';
import { PrismaClient, RSVP } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();


router.post('/', verifyIdToken, async (req: Request, res: Response) => {
    const { eventId, rsvpStatus } = req.body;
    const userId = req.userId;

    if (!eventId || !rsvpStatus) {
        res.status(400).json({ error: 'Missing eventId or rsvpStatus' });
        return;
    }

    try {
        const event = await prisma.event.findUnique({
            where: { id: eventId },
            select: { start_date_time: true }
        });

        if (!event) {
            res.status(404).json({ error: 'Event not found' });
            return;
        }

        if (new Date() > event.start_date_time) {
            res.status(400).json({ error: 'RSVP period has ended' });
            return;
        }

        const rsvp = await upsertRSVP(userId, eventId, rsvpStatus);
        res.json(rsvp);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to RSVP' });
    }
});


router.delete('/', verifyIdToken, async (req: Request, res: Response) => {
    const { eventId } = req.body;
    const userId = req.userId;

    if (!eventId) {
        res.status(400).json({ error: 'Missing eventId' });
        return;
    }

    try {
        const result = await cancelRSVP(userId, eventId);
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to cancel RSVP' });
    }
});


router.get('/my-events', verifyIdToken, async (req, res) => {
    const userId = req.userId;

    try {
        const rsvps = await listUserRSVPs(userId);
        res.json(rsvps);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch RSVPs' });
    }
});


router.get('/summary/:eventId', verifyIdToken, async (req, res) => {
    const { eventId } = req.params;
    const userId = req.userId;

    try {
        // Check if user is host or co-host
        const event = await prisma.event.findUnique({
            where: { id: eventId },
            select: {
                hostId: true,
                co_hosts: { select: { id: true } }
            }
        });

        if (!event) {
            res.status(404).json({ error: 'Event not found' });
            return;
        }

        const isHost = event.hostId === userId;
        const isCoHost = event.co_hosts.some(coHost => coHost.id === userId);

        if (!isHost && !isCoHost) {
            res.status(403).json({ error: 'Access denied. Only hosts and co-hosts can view RSVP summary' });
            return;
        }

        const summary = await prisma.guest.groupBy({
            by: ['rsvp', 'food', 'alcohol', 'accommodation'],
            where: { event_id: eventId },
            _count: { _all: true }
        });

        res.json(summary);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch RSVP summary' });
    }
});

router.get('/list/:eventId', verifyIdToken, async (req, res) => {
    const { eventId } = req.params;
    const { rsvp, food, alcohol, accommodation } = req.query;
    const userId = req.userId;

    try {
        // Check if user is host or co-host
        const event = await prisma.event.findUnique({
            where: { id: eventId },
            select: {
                hostId: true,
                co_hosts: { select: { id: true } }
            }
        });

        if (!event) {
            res.status(404).json({ error: 'Event not found' });
            return;
        }

        const isHost = event.hostId === userId;
        const isCoHost = event.co_hosts.some(coHost => coHost.id === userId);

        if (!isHost && !isCoHost) {
            res.status(403).json({ error: 'Access denied. Only hosts and co-hosts can view guest list' });
            return;
        }

        const guests = await prisma.guest.findMany({
            where: {
                event_id: eventId,
                ...(rsvp && { rsvp: rsvp as RSVP }),
                ...(food && { food: food as string }),
                ...(alcohol && { alcohol: alcohol as string }),
                ...(accommodation && { accommodation: accommodation as string })
            },
            include: {
                user: { select: { name: true, mobile_number: true } }
            }
        });

        res.json(guests);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch guest list' });
    }
});


router.get('/:eventId', verifyIdToken, async (req, res) => {
    const { eventId } = req.params;
    const userId = req.userId;

    try {
        const status = await getRSVPStatus(userId, eventId);
        res.json(status);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to get RSVP status' });
    }
});

export default router;
