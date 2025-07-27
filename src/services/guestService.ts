import { PrismaClient } from '@prisma/client';
import { getUserByPhoneNumber } from './userService';

const prisma = new PrismaClient();

// Guest Group CRUD Operations

export const createGuestGroup = async (eventId: string, data: {
  name: string;
  members?: string[];
}) => {
  try {
    const guestGroup = await prisma.guestGroup.create({
      data: {
        name: data.name,
        members: data.members || [],
        count: data.members?.length || 0,
      },
    });

    return {
      success: true,
      guestGroup,
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
        error: 'Failed to create guest group',
      };
    }
  }
};

export const getGuestGroups = async (eventId: string) => {
  try {
    // Get all guest groups associated with guests for this event
    const guestGroups = await prisma.guestGroup.findMany({
      where: {
        guests: {
          some: {
            event_id: eventId,
          },
        },
      },
      include: {
        guests: {
          where: {
            event_id: eventId,
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                mobile_number: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return {
      success: true,
      guestGroups,
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

export const getGuestGroup = async (groupId: string) => {
  try {
    const guestGroup = await prisma.guestGroup.findUnique({
      where: { id: groupId },
      include: {
        guests: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                mobile_number: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!guestGroup) {
      return {
        success: false,
        error: 'Guest group not found',
      };
    }

    return {
      success: true,
      guestGroup,
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
        error: 'Failed to get guest group',
      };
    }
  }
};

export const updateGuestGroup = async (groupId: string, data: {
  name?: string;
  members?: string[];
}) => {
  try {
    const updatedGuestGroup = await prisma.guestGroup.update({
      where: { id: groupId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.members && { 
          members: data.members,
          count: data.members.length,
        }),
      },
      include: {
        guests: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                mobile_number: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return {
      success: true,
      guestGroup: updatedGuestGroup,
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
        error: 'Failed to update guest group',
      };
    }
  }
};

export const deleteGuestGroup = async (groupId: string) => {
  try {
    // First, remove the group reference from all guests in this group
    await prisma.guest.updateMany({
      where: { group_id: groupId },
      data: { group_id: null },
    });

    // Then delete the group
    await prisma.guestGroup.delete({
      where: { id: groupId },
    });

    return {
      success: true,
      message: 'Guest group deleted successfully',
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
        error: 'Failed to delete guest group',
      };
    }
  }
};

// Guest Group Member Management

export const addMemberToGroup = async (groupId: string, eventId: string, phoneNumber: string) => {
  try {
    // Find user by phone number
    const user = await getUserByPhoneNumber(phoneNumber);
    if (!user) {
      return {
        success: false,
        error: 'User not found with this phone number',
      };
    }

    // Check if user is already a guest for this event
    let guest = await prisma.guest.findUnique({
      where: {
        user_id_event_id: {
          user_id: user.id,
          event_id: eventId,
        },
      },
    });

    // If guest doesn't exist, create one
    if (!guest) {
      guest = await prisma.guest.create({
        data: {
          user_id: user.id,
          event_id: eventId,
          group_id: groupId,
        },
      });
    } else {
      // If guest exists, update their group
      guest = await prisma.guest.update({
        where: { id: guest.id },
        data: { group_id: groupId },
      });
    }

    // Add phone number to group members array if not already present
    const guestGroup = await prisma.guestGroup.findUnique({
      where: { id: groupId },
    });

    if (guestGroup && !guestGroup.members.includes(phoneNumber)) {
      await prisma.guestGroup.update({
        where: { id: groupId },
        data: {
          members: {
            push: phoneNumber,
          },
          count: guestGroup.count + 1,
        },
      });
    }

    return {
      success: true,
      guest,
      message: 'Member added to group successfully',
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
        error: 'Failed to add member to group',
      };
    }
  }
};

export const removeMemberFromGroup = async (groupId: string, phoneNumber: string) => {
  try {
    // Find user by phone number
    const user = await getUserByPhoneNumber(phoneNumber);
    if (!user) {
      return {
        success: false,
        error: 'User not found with this phone number',
      };
    }

    // Update guest to remove group reference
    await prisma.guest.updateMany({
      where: {
        user_id: user.id,
        group_id: groupId,
      },
      data: {
        group_id: null,
      },
    });

    // Remove phone number from group members array
    const guestGroup = await prisma.guestGroup.findUnique({
      where: { id: groupId },
    });

    if (guestGroup && guestGroup.members.includes(phoneNumber)) {
      const updatedMembers = guestGroup.members.filter(member => member !== phoneNumber);
      await prisma.guestGroup.update({
        where: { id: groupId },
        data: {
          members: updatedMembers,
          count: Math.max(0, guestGroup.count - 1),
        },
      });
    }

    return {
      success: true,
      message: 'Member removed from group successfully',
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
        error: 'Failed to remove member from group',
      };
    }
  }
};

// Utility function to check if user is event host or co-host
export const isEventHostOrCoHost = async (userId: string, eventId: string) => {
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
