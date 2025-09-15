import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// SubEvent CRUD Operations

export const createSubEvent = async (eventId: string, data: {
  title: string;
  location: string;
  address: string;
  start_date_time: string;
  end_date_time: string;
  invite_message?: string;
  image?: string;
  guests?: string[];
}) => {
  try {
    const subEvent = await prisma.subEvent.create({
      data: {
        title: data.title,
        location: data.location,
        address: data.address,
        start_date_time: new Date(data.start_date_time),
        end_date_time: new Date(data.end_date_time),
        invite_message: data.invite_message,
        image: data.image,
        event_id: eventId,
        guests: data.guests || [],
        messages: [],
      },
    });

    return {
      success: true,
      subEvent,
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      };
    } else {
      return {
        success: false,
        error: 'Failed to create sub-event',
      };
    }
  }
};

export const getSubEvents = async (eventId: string) => {
  try {
    const subEvents = await prisma.subEvent.findMany({
      where: {
        event_id: eventId,
      },
      include: {
        parentEvent: {
          select: {
            id: true,
            title: true,
            hostId: true,
          },
        },
      },
      orderBy: {
        start_date_time: 'asc',
      },
    });

    return {
      success: true,
      subEvents,
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      };
    } else {
      return {
        success: false,
        error: 'Failed to get sub-events',
      };
    }
  }
};

export const getSubEvent = async (subEventId: string) => {
  try {
    const subEvent = await prisma.subEvent.findUnique({
      where: { id: subEventId },
      include: {
        parentEvent: {
          select: {
            id: true,
            title: true,
            hostId: true,
          },
        },
      },
    });

    if (!subEvent) {
      return {
        success: false,
        error: 'Sub-event not found',
      };
    }

    return {
      success: true,
      subEvent,
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      };
    } else {
      return {
        success: false,
        error: 'Failed to get sub-event',
      };
    }
  }
};

export const updateSubEvent = async (subEventId: string, data: {
  title?: string;
  location?: string;
  address?: string;
  start_date_time?: string;
  end_date_time?: string;
  invite_message?: string;
  image?: string;
  guests?: string[];
}) => {
  try {
    const updatedSubEvent = await prisma.subEvent.update({
      where: { id: subEventId },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.location && { location: data.location }),
        ...(data.address && { address: data.address }),
        ...(data.start_date_time && { start_date_time: new Date(data.start_date_time) }),
        ...(data.end_date_time && { end_date_time: new Date(data.end_date_time) }),
        ...(data.invite_message !== undefined && { invite_message: data.invite_message }),
        ...(data.image !== undefined && { image: data.image }),
        ...(data.guests && { guests: data.guests }),
      },
      include: {
        parentEvent: {
          select: {
            id: true,
            title: true,
            hostId: true,
          },
        },
      },
    });

    return {
      success: true,
      subEvent: updatedSubEvent,
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      };
    } else {
      return {
        success: false,
        error: 'Failed to update sub-event',
      };
    }
  }
};

export const deleteSubEvent = async (subEventId: string) => {
  try {
    await prisma.subEvent.delete({
      where: { id: subEventId },
    });

    return {
      success: true,
      message: 'Sub-event deleted successfully',
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      };
    } else {
      return {
        success: false,
        error: 'Failed to delete sub-event',
      };
    }
  }
};

// SubEvent Guest Management

export const addGuestToSubEvent = async (subEventId: string, guestId: string) => {
  try {
    const subEvent = await prisma.subEvent.findUnique({
      where: { id: subEventId },
    });

    if (!subEvent) {
      return {
        success: false,
        error: 'Sub-event not found',
      };
    }

    if (subEvent.guests.includes(guestId)) {
      return {
        success: false,
        error: 'User is already a guest of this sub-event',
      };
    }

    const updatedSubEvent = await prisma.subEvent.update({
      where: { id: subEventId },
      data: {
        guests: {
          push: guestId,
        },
      },
    });

    return {
      success: true,
      subEvent: updatedSubEvent,
      message: 'Guest added successfully',
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      };
    } else {
      return {
        success: false,
        error: 'Failed to add guest',
      };
    }
  }
};

export const removeGuestFromSubEvent = async (subEventId: string, guestId: string) => {
  try {
    const subEvent = await prisma.subEvent.findUnique({
      where: { id: subEventId },
    });

    if (!subEvent) {
      return {
        success: false,
        error: 'Sub-event not found',
      };
    }

    const updatedGuests = subEvent.guests.filter(id => id !== guestId);

    const updatedSubEvent = await prisma.subEvent.update({
      where: { id: subEventId },
      data: {
        guests: updatedGuests,
      },
    });

    return {
      success: true,
      subEvent: updatedSubEvent,
      message: 'Guest removed successfully',
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      };
    } else {
      return {
        success: false,
        error: 'Failed to remove guest',
      };
    }
  }
};

// Utility function to check if user can manage sub-event (is host or co-host of parent event)
export const canManageSubEvent = async (userId: string, subEventId: string) => {
  try {
    const subEvent = await prisma.subEvent.findUnique({
      where: { id: subEventId },
      include: {
        parentEvent: {
          include: {
            co_hosts: true,
          },
        },
      },
    });

    if (!subEvent || !subEvent.parentEvent) {
      return false;
    }

    // Check if user is the host of parent event
    if (subEvent.parentEvent.hostId === userId) {
      return true;
    }

    // Check if user is a co-host of parent event
    return subEvent.parentEvent.co_hosts.some(coHost => coHost.id === userId);
  } catch (error) {
    return false;
  }
};

// Utility function to check if user can manage sub-events for an event
export const canManageEventSubEvents = async (userId: string, eventId: string) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        co_hosts: true,
      },
    });

    if (!event) {
      return false;
    }

    // Check if user is the host
    if (event.hostId === userId) {
      return true;
    }

    // Check if user is a co-host
    return event.co_hosts.some(coHost => coHost.id === userId);
  } catch (error) {
    return false;
  }
};
