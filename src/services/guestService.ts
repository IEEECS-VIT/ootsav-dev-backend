import { PrismaClient, FoodPreference, AlcoholPreference, InviteLinkStatus, RSVP } from '@prisma/client';
import { getUserByPhoneNumber, createUser } from './userService';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();


export const createGuestGroup = async (data: {
  name: string;
  createdBy: string;
  eventId: string;
}) => {
  try {
    const guestGroup = await prisma.$transaction(async (tx) => {
      const newGuestGroup = await tx.guestGroup.create({
        data: {
          name: data.name,
          createdBy: data.createdBy,
        },
      });

      await tx.eventGuestGroup.create({
        data: {
          event_id: data.eventId,
          guest_group_id: newGuestGroup.id,
        },
      });

      return newGuestGroup;
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
    // Get all guest groups associated with this event through EventGuestGroup table
    const guestGroups = await prisma.guestGroup.findMany({
      where: {
        events: {
          some: {
            event_id: eventId,
          },
        },
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            mobile_number: true,
          }
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                mobile_number: true,
                email: true,
              }
            },
            addedBy: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        },
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
                verification_status: true
              },
            },
          },
        },
        inviteLinks: true,
        invites: {
          where: {
            event_id: eventId,
          }
        }
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
        creator: {
          select: {
            id: true,
            name: true,
            mobile_number: true,
          }
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                mobile_number: true,
                email: true,
              }
            },
            addedBy: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        },
        guests: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                mobile_number: true,
                email: true,
                verification_status: true
              },
            },
          },
        },
        inviteLinks: true,
        invites: true
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
}) => {
  try {
    const updatedGuestGroup = await prisma.guestGroup.update({
      where: { id: groupId },
      data: {
        ...(data.name && { name: data.name }),
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            mobile_number: true,
          }
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                mobile_number: true,
                email: true,
              }
            }
          }
        },
        guests: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                mobile_number: true,
                email: true,
                verification_status: true
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
    // Use transaction to ensure data consistency
    await prisma.$transaction(async (tx) => {
      // Remove group reference from all guests in this group
      await tx.guest.updateMany({
        where: { group_id: groupId },
        data: { group_id: null },
      });

      // Delete event-group associations
      await tx.eventGuestGroup.deleteMany({
        where: { guest_group_id: groupId },
      });

      // Delete invite links
      await tx.inviteLink.deleteMany({
        where: { group_id: groupId },
      });

      // Delete invites
      await tx.invite.deleteMany({
        where: { group_id: groupId },
      });

      // Delete guest group users (linking table)
      await tx.guestGroupUsers.deleteMany({
        where: { guest_group_id: groupId },
      });

      // Finally delete the group
      await tx.guestGroup.delete({
        where: { id: groupId },
      });
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


export const addUserToGroup = async (groupId: string, phoneNumber: string, addedBy: string) => {
  try {
    // Find user by phone number or create if doesn't exist
    let user = await getUserByPhoneNumber(phoneNumber);
    
    if (!user) {
      // Create unverified user with minimal info
      user = await createUser({
        name: `User_${phoneNumber}`, // Temporary name
        dob: new Date().toISOString(), // Temporary DOB
        mobile_number: phoneNumber,
        gender: 'Unspecified' as any,
        preferred_language: 'English' as any
      });
    }

    // Check if user is already in this group
    const existingMembership = await prisma.guestGroupUsers.findUnique({
      where: {
        guest_group_id_user_id: {
          guest_group_id: groupId,
          user_id: user.id,
        },
      },
    });

    if (existingMembership) {
      return {
        success: false,
        error: 'User is already a member of this group',
      };
    }

    // Add user to group
    const member = await prisma.guestGroupUsers.create({
      data: {
        guest_group_id: groupId,
        user_id: user.id,
        added_by: addedBy,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            mobile_number: true,
            email: true,
          }
        },
        addedBy: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });

    return {
      success: true,
      member,
      message: 'User added to group successfully',
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
        error: 'Failed to add user to group',
      };
    }
  }
};

export const removeUserFromGroup = async (groupId: string, phoneNumber: string) => {
  try {
    // Find user by phone number
    const user = await getUserByPhoneNumber(phoneNumber);
    if (!user) {
      return {
        success: false,
        error: 'User not found with this phone number',
      };
    }

    // Remove user from group
    const deletedMember = await prisma.guestGroupUsers.delete({
      where: {
        guest_group_id_user_id: {
          guest_group_id: groupId,
          user_id: user.id,
        },
      },
    });

    // Also remove group reference from guest records but keep the guest records
    await prisma.guest.updateMany({
      where: {
        user_id: user.id,
        group_id: groupId,
      },
      data: {
        group_id: null,
      },
    });

    return {
      success: true,
      message: 'User removed from group successfully',
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
        error: 'Failed to remove user from group',
      };
    }
  }
};

export const addGuestGroupToEvent = async (eventId: string, groupId: string) => {
  try {
    // First create the event-group association
    await prisma.eventGuestGroup.upsert({
      where: {
        event_id_guest_group_id: {
          event_id: eventId,
          guest_group_id: groupId,
        },
      },
      update: {},
      create: {
        event_id: eventId,
        guest_group_id: groupId,
      },
    });

    const groupMembers = await prisma.guestGroupUsers.findMany({
      where: { guest_group_id: groupId },
      select: { user_id: true },
    });

    if (groupMembers.length === 0) {
      return {
        success: true,
        guests: [],
        message: "No members in the group to add."
      };
    }

    const guestData = groupMembers.map(member => ({
      user_id: member.user_id,
      event_id: eventId,
      group_id: groupId,
      rsvp: 'no_response' as RSVP,
      count: 1,
    }));

    await prisma.guest.createMany({
      data: guestData,
      skipDuplicates: true, // Avoids errors if a guest is already in the event
    });

    const guests = await prisma.guest.findMany({
        where: {
            event_id: eventId,
            group_id: groupId,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              mobile_number: true,
              email: true,
              verification_status: true
            }
          }
        }
    });

    return {
      success: true,
      guests,
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
        error: 'Failed to add guest group to event',
      };
    }
  }
};

// ===== UTILITY FUNCTIONS =====

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

// Function to check if user can add members to a specific group
export const canUserAddToGroup = async (userId: string, groupId: string) => {
  try {
    const group = await prisma.guestGroup.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      return false;
    }

    // User can add if they created the group
    return group.createdBy === userId;
  } catch (error) {
    return false;
  }
};

export const canUserManageGroup = async (userId: string, groupId: string) => {
  try {
    const group = await prisma.guestGroup.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      return false;
    }

    return group.createdBy === userId;
  } catch (error) {
    return false;
  }
};

// Legacy function for backward compatibility - keeping the old API
export const addMemberToGroup = async (groupId: string, eventId: string, phoneNumber: string) => {
  try {
    // Find the group creator to use as addedBy
    const group = await prisma.guestGroup.findUnique({
      where: { id: groupId },
      select: { createdBy: true }
    });

    if (!group) {
      return {
        success: false,
        error: 'Group not found',
      };
    }

    // Use the new addUserToGroup function
    const result = await addUserToGroup(groupId, phoneNumber, group.createdBy);
    
    if (!result.success) {
      return result;
    }

    // Also create a guest record for the event if it doesn't exist
    const user = await getUserByPhoneNumber(phoneNumber);
    if (user) {
      const existingGuest = await prisma.guest.findFirst({
        where: {
          user_id: user.id,
          event_id: eventId,
        },
        select: { id: true }
      });
      if (existingGuest) {
        await prisma.guest.update({
          where: { id: existingGuest.id },
          data: { group_id: groupId }
        });
      } else {
        await prisma.guest.create({
          data: {
            user_id: user.id,
            event_id: eventId,
            group_id: groupId,
            rsvp: 'no_response',
            count: 1,
          }
        });
      }
    }

    return {
      success: true,
      guest: result.member,
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

// Legacy function for backward compatibility - keeping the old API  
export const removeMemberFromGroup = async (groupId: string, phoneNumber: string) => {
  return await removeUserFromGroup(groupId, phoneNumber);
};

// Function to get event details by invite link (helper for processing invites)
export const getEventByInviteLink = async (inviteLink: string) => {
  try {
    const inviteLinkRecord = await prisma.inviteLink.findUnique({
      where: { invite_link: inviteLink },
      include: {
        guestGroup: {
          include: {
            events: {
              include: {
                event: {
                  select: {
                    id: true,
                    title: true,
                    type: true,
                    location: true,
                    address: true,
                    start_date_time: true,
                    end_date_time: true,
                    image: true,
                    invite_message: true,
                  }
                }
              },
              take: 1
            }
          }
        }
      }
    });

    if (!inviteLinkRecord || !inviteLinkRecord.guestGroup.events[0]) {
      return null;
    }

    return inviteLinkRecord.guestGroup.events[0].event;
  } catch (error) {
    return null;
  }
};

// Function to check if a phone number exists in any group for an event
export const findUserGroupForEvent = async (phoneNumber: string, eventId: string) => {
  try {
    const user = await getUserByPhoneNumber(phoneNumber);
    if (!user) {
      return null;
    }

    const groupMembership = await prisma.guestGroupUsers.findFirst({
      where: {
        user_id: user.id,
        guestGroup: {
          events: {
            some: {
              event_id: eventId,
            }
          }
        }
      },
      include: {
        guestGroup: true
      }
    });

    return groupMembership?.guestGroup || null;
  } catch (error) {
    return null;
  }
};

// Function to get all RSVPs for an event including unlinked ones
export const getEventRsvpsWithUnlinked = async (eventId: string, userId: string) => {
  try {
    // Verify user is host or co-host
    const isAuthorized = await isEventHostOrCoHost(userId, eventId);
    if (!isAuthorized) {
      return {
        success: false,
        error: 'Access denied. Only hosts and co-hosts can view RSVPs'
      };
    }

    // Get all guests for the event including unlinked ones
    const guests = await prisma.guest.findMany({
      where: { event_id: eventId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            mobile_number: true,
            email: true,
            verification_status: true
          }
        },
        group: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: [
        { group: { name: 'asc' } },
        { user: { name: 'asc' } },
        { name: 'asc' }
      ]
    });

    // Separate linked and unlinked guests
    const linkedGuests = guests.filter(guest => guest.user_id !== null);
    const unlinkedGuests = guests.filter(guest => guest.user_id === null);

    return {
      success: true,
      linkedGuests,
      unlinkedGuests,
      totalGuests: guests.length
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get event RSVPs'
    };
  }
};