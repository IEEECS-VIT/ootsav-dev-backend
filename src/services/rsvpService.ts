import { PrismaClient, RSVP } from '@prisma/client';

const prisma = new PrismaClient();

export const upsertRSVP = async (userId: string, eventId: string, rsvpStatus: RSVP) => {
    return prisma.guest.upsert({
        where: {
            user_id_event_id: {
                user_id: userId,
                event_id: eventId
            }
        },
        update: {
            rsvp: rsvpStatus
        },
        create: {
            user_id: userId,
            event_id: eventId,
            rsvp: rsvpStatus
        }
    });
};

export const cancelRSVP = async (userId: string, eventId: string) => {
    return prisma.guest.update({
        where: {
            user_id_event_id: {
                user_id: userId,
                event_id: eventId
            }
        },
        data: {
            rsvp: 'no_response'
        }
    });
};

export const getRSVPStatus = async (userId: string, eventId: string) => {
    return prisma.guest.findUnique({
        where: {
            user_id_event_id: {
                user_id: userId,
                event_id: eventId
            }
        },
        select: {
            rsvp: true
        }
    });
};

export const listUserRSVPs = async (userId: string) => {
    return prisma.guest.findMany({
        where: {
            user_id: userId,
            rsvp: {
                not: 'no_response'
            }
        },
        select: {
            event_id: true,
            rsvp: true
        }
    });
};
