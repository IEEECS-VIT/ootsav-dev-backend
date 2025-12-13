import { PrismaClient, FoodPreference, InviteLinkStatus, RSVP } from '@prisma/client';
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
    // Check if group exists
    const guestGroup = await prisma.guestGroup.findUnique({
      where: { id: groupId },
      include: {
        members: true,
        guests: true,
        events: {
          include: {
            event: { select: { title: true } }
          }
        }
      }
    });

    if (!guestGroup) {
      return {
        success: false,
        error: 'Guest group not found'
      };
    }

    // Delete the guest group and all related records in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete all messages related to guests in this group
      const guestIds = guestGroup.guests.map(g => g.id);
      if (guestIds.length > 0) {
        await tx.message.deleteMany({
          where: { guest_id: { in: guestIds } }
        });
      }

      // Delete all guests in this group
      await tx.guest.deleteMany({
        where: { group_id: groupId }
      });

      // Delete all invites associated with this group
      await tx.invite.deleteMany({
        where: { group_id: groupId }
      });

      // Delete the guest group (cascade will handle GuestGroupUsers, InviteLinks, and EventGuestGroup)
      await tx.guestGroup.delete({
        where: { id: groupId }
      });
    });

    return {
      success: true,
      message: 'Guest group and all associated members and guests deleted successfully'
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete guest group'
    };
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
    // Check if the group exists
    const groupExists = await prisma.guestGroup.findUnique({
      where: { id: groupId },
      select: { id: true, name: true }
    });

    if (!groupExists) {
      return {
        success: false,
        error: 'Guest group not found',
      };
    }

    // Check if the event exists
    const eventExists = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true }
    });

    if (!eventExists) {
      return {
        success: false,
        error: 'Event not found',
      };
    }

    // Check if the association already exists
    const existingAssociation = await prisma.eventGuestGroup.findUnique({
      where: {
        event_id_guest_group_id: {
          event_id: eventId,
          guest_group_id: groupId,
        },
      },
    });

    if (existingAssociation) {
      return {
        success: false,
        error: 'Guest group is already associated with this event',
      };
    }

    // Create the event-group association
    await prisma.eventGuestGroup.create({
      data: {
        event_id: eventId,
        guest_group_id: groupId,
      },
    });

    // Get all members of the group
    const groupMembers = await prisma.guestGroupUsers.findMany({
      where: { guest_group_id: groupId },
      select: { user_id: true },
    });

    if (groupMembers.length === 0) {
      return {
        success: true,
        guests: [],
        message: `Guest group "${groupExists.name}" added to event "${eventExists.title}" successfully. No members in the group to add as guests.`
      };
    }

    // Create guest records for all group members
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

    // Fetch the created guests with user details
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
      message: `Guest group "${groupExists.name}" added to event "${eventExists.title}" successfully. ${guests.length} guests added.`
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

export const removeGuestGroupFromEvent = async (eventId: string, groupId: string) => {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await prisma.$transaction(async (tx) => {
        // Check if the association exists first
        const existingAssociation = await tx.eventGuestGroup.findUnique({
          where: {
            event_id_guest_group_id: {
              event_id: eventId,
              guest_group_id: groupId,
            },
          },
        });

        if (!existingAssociation) {
          throw new Error('Guest group is not associated with this event');
        }

        // Remove the event-group association
        await tx.eventGuestGroup.delete({
          where: {
            event_id_guest_group_id: {
              event_id: eventId,
              guest_group_id: groupId,
            },
          },
        });

        // Remove group reference from guests for this specific event
        // but keep the guest records (just set group_id to null)
        await tx.guest.updateMany({
          where: {
            event_id: eventId,
            group_id: groupId,
          },
          data: {
            group_id: null,
          },
        });

        // Remove invites for this specific event-group combination
        await tx.invite.deleteMany({
          where: {
            event_id: eventId,
            group_id: groupId,
          },
        });
      }, {
        maxWait: 5000, // 5 seconds
        timeout: 10000, // 10 seconds
      });

      return {
        success: true,
        message: 'Guest group removed from event successfully. The group still exists and can be added to other events.',
      };
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      if (attempt < maxRetries && lastError.message.includes('Transaction')) {
        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        continue;
      }
      
      // If it's not a transaction error or we've exceeded retries, break
      break;
    }
  }

  return {
    success: false,
    error: lastError?.message || 'Failed to remove guest group from event',
  };
};
export const getMyGuestGroups = async (userId: string) => {
  try {
    // First, get the basic guest groups without includes to avoid relation errors
    const basicGroups = await prisma.guestGroup.findMany({
      where: {
        createdBy: userId,
      },
      orderBy: {
        id: 'desc', // Use 'id' instead of created_at/createdAt to avoid field name issues
      }
    });

    if (basicGroups.length === 0) {
      return {
        success: true,
        guestGroups: [],
        totalGroups: 0,
      };
    }

    // Then fetch related data separately to avoid relation issues
    const transformedGroups = await Promise.all(
      basicGroups.map(async (group) => {
        // Get creator info
        const creator = await prisma.user.findUnique({
          where: { id: group.createdBy },
          select: {
            id: true,
            name: true,
            mobile_number: true,
          }
        });

        // Get members count and details
        const members = await prisma.guestGroupUsers.findMany({
          where: { guest_group_id: group.id },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                mobile_number: true,
                email: true,
                verification_status: true,
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

        // Get events associated with this group
        const eventGroups = await prisma.eventGuestGroup.findMany({
          where: { guest_group_id: group.id },
          include: {
            event: {
              select: {
                id: true,
                title: true,
                type: true,
                location: true,
                start_date_time: true,
                end_date_time: true,
                image: true,
                hostId: true,
                host: {
                  select: {
                    id: true,
                    name: true,
                  }
                }
              }
            }
          }
        });

        // Get guests for this group
        const guests = await prisma.guest.findMany({
          where: { group_id: group.id },
          select: {
            id: true,
            rsvp: true,
            count: true,
            event_id: true,
            user: {
              select: {
                id: true,
                name: true,
                mobile_number: true,
              }
            }
          }
        });

        // Get invite links
        const inviteLinks = await prisma.inviteLink.findMany({
          where: { group_id: group.id },
          select: {
            id: true,
            invite_link: true,
            status: true,
            created_at: true,
          }
        });

        return {
          id: group.id,
          name: group.name,
          creator: creator,
          memberCount: members.length,
          guestCount: guests.length,
          eventCount: eventGroups.length,
          members: members,
          events: eventGroups.map((eventGroup) => ({
            id: eventGroup.event.id,
            title: eventGroup.event.title,
            type: eventGroup.event.type,
            location: eventGroup.event.location,
            startDateTime: eventGroup.event.start_date_time,
            endDateTime: eventGroup.event.end_date_time,
            image: eventGroup.event.image,
            host: eventGroup.event.host,
            isMyEvent: eventGroup.event.hostId === userId,
          })),
          inviteLinks: inviteLinks,
          // Group guests by event for better organization
          guestsByEvent: guests.reduce((acc: Record<string, any[]>, guest) => {
            if (!acc[guest.event_id]) {
              acc[guest.event_id] = [];
            }
            acc[guest.event_id].push({
              id: guest.id,
              rsvp: guest.rsvp,
              count: guest.count,
              user: guest.user,
            });
            return acc;
          }, {} as Record<string, any[]>),
          // Summary statistics
          statistics: {
            totalAccepted: guests.filter(g => g.rsvp === 'accepted').length,
            totalDeclined: guests.filter(g => g.rsvp === 'declined').length,
            totalMaybe: guests.filter(g => g.rsvp === 'maybe').length,
            totalNoResponse: guests.filter(g => g.rsvp === 'no_response').length,
            totalGuests: guests.reduce((sum, g) => sum + g.count, 0),
          }
        };
      })
    );

    return {
      success: true,
      guestGroups: transformedGroups,
      totalGroups: transformedGroups.length,
    };
  } catch (error: unknown) {
    console.error('Error in getMyGuestGroups:', error);
    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      };
    } else {
      return {
        success: false,
        error: 'Failed to get user guest groups',
      };
    }
  }
};

export const getAvailableGuestGroupsForEvent = async (userId: string, eventId: string) => {
  try {
    // Get all groups created by this user that are NOT already associated with the event
    const availableGroups = await prisma.guestGroup.findMany({
      where: {
        createdBy: userId,
        NOT: {
          events: {
            some: {
              event_id: eventId,
            }
          }
        }
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
                verification_status: true,
              }
            }
          }
        },
        _count: {
          select: {
            members: true,
            events: true,
          }
        }
      },
      orderBy: {
        name: 'asc',
      }
    });

    // Transform the data for better readability
    const transformedGroups = availableGroups.map(group => ({
      id: group.id,
      name: group.name,
      creator: group.creator,
      memberCount: group._count.members,
      eventCount: group._count.events,
      members: group.members.map(member => ({
        id: member.user.id,
        name: member.user.name,
        mobileNumber: member.user.mobile_number,
        email: member.user.email,
        verificationStatus: member.user.verification_status,
      })),
      canBeAdded: true, // All groups in this list can be added to the event
    }));

    return {
      success: true,
      availableGroups: transformedGroups,
      totalAvailable: transformedGroups.length,
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
        error: 'Failed to get available guest groups for event',
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

// New function to remove a guest from an event
export const removeGuestFromEvent = async (guestId: string, eventId: string) => {
  try {
    // Check if guest exists and belongs to the specified event
    const guest = await prisma.guest.findUnique({
      where: { id: guestId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            mobile_number: true
          }
        },
        group: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!guest) {
      return {
        success: false,
        error: 'Guest not found'
      };
    }

    if (guest.event_id !== eventId) {
      return {
        success: false,
        error: 'Guest does not belong to this event'
      };
    }

    // Delete the guest and related messages in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete all messages from this guest
      await tx.message.deleteMany({
        where: { guest_id: guestId }
      });

      // Delete the guest record
      await tx.guest.delete({
        where: { id: guestId }
      });
    });

    return {
      success: true,
      message: 'Guest removed from event successfully',
      removedGuest: {
        id: guest.id,
        name: guest.name || guest.user?.name,
        phone: guest.phone_no || guest.user?.mobile_number,
        groupName: guest.group?.name
      }
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove guest from event'
    };
  }
};
