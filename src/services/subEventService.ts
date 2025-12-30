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
        guests: [],
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
        guestGroups: {
          include: {
            guestGroup: {
              select: {
                id: true,
                name: true,
              },
            },
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

// Get sub-events filtered by user role
export const getSubEventsForUser = async (eventId: string, userId: string) => {
  try {
    // First check if user is host or co-host
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        co_hosts: {
          select: { id: true }
        }
      }
    });

    if (!event) {
      return {
        success: false,
        error: 'Event not found',
      };
    }

    const isHost = event.hostId === userId;
    const isCoHost = event.co_hosts.some(coHost => coHost.id === userId);

    // If host or co-host, return all sub-events
    if (isHost || isCoHost) {
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
          guestGroups: {
            include: {
              guestGroup: {
                select: {
                  id: true,
                  name: true,
                },
              },
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
        role: isHost ? 'host' : 'co-host',
      };
    }

    // For participants, find their guest groups and get accessible sub-events
    const userGuestGroups = await prisma.guest.findMany({
      where: {
        user_id: userId,
        event_id: eventId,
      },
      select: {
        group_id: true,
      },
    });

    const guestGroupIds = userGuestGroups
      .map(guest => guest.group_id)
      .filter((id): id is string => id !== null);

    if (guestGroupIds.length === 0) {
      return {
        success: true,
        subEvents: [],
        role: 'participant',
      };
    }

    // Get sub-events that have at least one of the user's guest groups
    const subEvents = await prisma.subEvent.findMany({
      where: {
        event_id: eventId,
        guestGroups: {
          some: {
            guest_group_id: {
              in: guestGroupIds,
            },
          },
        },
      },
      include: {
        parentEvent: {
          select: {
            id: true,
            title: true,
            hostId: true,
          },
        },
        guestGroups: {
          include: {
            guestGroup: {
              select: {
                id: true,
                name: true,
              },
            },
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
      role: 'participant',
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
        error: 'Failed to get sub-events for user',
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
        guestGroups: {
          include: {
            guestGroup: {
              select: {
                id: true,
                name: true,
              },
            },
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

// SubEvent Guest Group Management

export const addGuestGroupToSubEvent = async (subEventId: string, guestGroupId: string) => {
  try {
    // Check if sub-event exists
    const subEvent = await prisma.subEvent.findUnique({
      where: { id: subEventId },
      include: {
        parentEvent: true,
      },
    });

    if (!subEvent) {
      return {
        success: false,
        error: 'Sub-event not found',
      };
    }

    // Check if guest group exists and is associated with the parent event
    const eventGuestGroup = await prisma.eventGuestGroup.findFirst({
      where: {
        event_id: subEvent.event_id!,
        guest_group_id: guestGroupId,
      },
      include: {
        guestGroup: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!eventGuestGroup) {
      return {
        success: false,
        error: 'Guest group not found or not associated with the parent event',
      };
    }

    // Check if association already exists
    const existingAssociation = await prisma.subEventGuestGroup.findUnique({
      where: {
        sub_event_id_guest_group_id: {
          sub_event_id: subEventId,
          guest_group_id: guestGroupId,
        },
      },
    });

    if (existingAssociation) {
      return {
        success: false,
        error: 'Guest group is already associated with this sub-event',
      };
    }

    // Create association
    await prisma.subEventGuestGroup.create({
      data: {
        sub_event_id: subEventId,
        guest_group_id: guestGroupId,
      },
    });

    // Get updated sub-event with guest groups
    const updatedSubEvent = await prisma.subEvent.findUnique({
      where: { id: subEventId },
      include: {
        guestGroups: {
          include: {
            guestGroup: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return {
      success: true,
      message: 'Guest group added to sub-event successfully',
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
        error: 'Failed to add guest group to sub-event',
      };
    }
  }
};

export const removeGuestGroupFromSubEvent = async (subEventId: string, guestGroupId: string) => {
  try {
    // Check if association exists
    const association = await prisma.subEventGuestGroup.findUnique({
      where: {
        sub_event_id_guest_group_id: {
          sub_event_id: subEventId,
          guest_group_id: guestGroupId,
        },
      },
    });

    if (!association) {
      return {
        success: false,
        error: 'Guest group is not associated with this sub-event',
      };
    }

    // Delete association
    await prisma.subEventGuestGroup.delete({
      where: {
        sub_event_id_guest_group_id: {
          sub_event_id: subEventId,
          guest_group_id: guestGroupId,
        },
      },
    });

    // Get updated sub-event with guest groups
    const updatedSubEvent = await prisma.subEvent.findUnique({
      where: { id: subEventId },
      include: {
        guestGroups: {
          include: {
            guestGroup: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return {
      success: true,
      message: 'Guest group removed from sub-event successfully',
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
        error: 'Failed to remove guest group from sub-event',
      };
    }
  }
};

export const getSubEventGuestGroups = async (subEventId: string) => {
  try {
    const subEvent = await prisma.subEvent.findUnique({
      where: { id: subEventId },
      include: {
        guestGroups: {
          include: {
            guestGroup: {
              select: {
                id: true,
                name: true,
              },
            },
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
      guestGroups: subEvent.guestGroups.map(sg => sg.guestGroup),
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
        error: 'Failed to get guest groups',
      };
    }
  }
};
