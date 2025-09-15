import { PrismaClient, RSVP } from '@prisma/client';
import { getUserByPhoneNumber, createUser } from './userService';
import { isEventHostOrCoHost } from './guestService';
import { getRsvpPreferencesForGroup } from './rsvpPreferencesService';

const prisma = new PrismaClient();

// ===== GROUP INVITE LINK GENERATION =====

// Generate simple invite link using eventId and groupId
export const generateGroupInviteLink = async (eventId: string, groupId: string) => {
  try {
    // First check if the group exists and is associated with this event
    const eventGroup = await prisma.eventGuestGroup.findFirst({
      where: {
        event_id: eventId,
        guest_group_id: groupId
      },
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
            invite_message: true 
          } 
        },
        guestGroup: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!eventGroup) {
      return {
        success: false,
        error: 'Group not found or not associated with this event'
      };
    }

    // Updated link format with both eventId and groupId
    const inviteLink = `https://ootsav.in/invite/${eventId}/${groupId}`;

    return {
      success: true,
      inviteLink,
      group: eventGroup.guestGroup,
      event: eventGroup.event
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate invite link'
    };
  }
};

// ===== GROUP INVITE DETAILS & RSVP =====

// Get group invite details by event ID and group ID (public endpoint)
export const getGroupInviteDetails = async (eventId: string, groupId: string, userId?: string) => {
  try {
    // Get the specific event and group association
    const eventGroup = await prisma.eventGuestGroup.findFirst({
      where: { 
        event_id: eventId,
        guest_group_id: groupId 
      },
      include: {
        event: { 
          include: {
            weddingDetails: true,
            birthdayDetails: true,
            housePartyDetails: true,
            travelDetails: true,
            corporateDetails: true,
            collegeDetails: true,
            otherDetails: true
          }
        },
        guestGroup: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!eventGroup) {
      return {
        success: false,
        error: 'Group invite not found or not associated with this event'
      };
    }

    // Check if event has passed
    if (new Date() > eventGroup.event.start_date_time) {
      return {
        success: false,
        error: 'This event has already started'
      };
    }

    // Get RSVP preferences for this group
    const rsvpPreferencesResult = await getRsvpPreferencesForGroup(eventId, groupId);
    let rsvpPreferences = null;
    let isRsvpLocked = false;

    if (rsvpPreferencesResult.success && rsvpPreferencesResult.preferences) {
      rsvpPreferences = rsvpPreferencesResult.preferences;
      isRsvpLocked = !rsvpPreferencesResult.preferences.isRsvpAllowed;
    }

    let userContext = null;

    // If user is authenticated, provide additional context
    if (userId) {
      // Check if user is host/co-host
      const isHostOrCoHost = await isEventHostOrCoHost(userId, eventId);
      
      // Check if user already has an RSVP for this event and group
      const existingRsvp = await prisma.guest.findFirst({
        where: {
          user_id: userId,
          event_id: eventId,
          group_id: groupId
        },
        select: {
          rsvp: true,
          food: true,
          alcohol: true,
          accommodation: true,
          count: true
        }
      });

      // Get user details for pre-filling form
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          name: true,
          mobile_number: true,
          email: true,
          verification_status: true
        }
      });

      userContext = {
        isHostOrCoHost,
        existingRsvp,
        userDetails: user,
        canEditRsvp: !isRsvpLocked && !isHostOrCoHost // Can't edit if locked or if host/cohost
      };
    }

    return {
      success: true,
      group: eventGroup.guestGroup,
      event: eventGroup.event,
      rsvpPreferences, // Include RSVP preferences
      isRsvpLocked,    // Include lock status
      userContext
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get group invite details'
    };
  }
};
// Submit RSVP for a specific event and group (public endpoint with optional auth)
export const submitGroupRsvp = async (
  eventId: string,
  groupId: string, 
  data: {
    name: string;
    phone_no: string;
    email?: string;
    rsvp: RSVP;
    food?: string;
    alcohol?: string;
    accommodation?: string;
    count?: number;
  },
  authenticatedUserId?: string
) => {
  try {
    // Verify the event and group association
    const eventGroup = await prisma.eventGuestGroup.findFirst({
      where: { 
        event_id: eventId,
        guest_group_id: groupId 
      },
      include: { 
        event: { select: { id: true, start_date_time: true, title: true } }
      }
    });

    if (!eventGroup) {
      return {
        success: false,
        error: 'Group not found or not associated with this event'
      };
    }

    // Check if event has passed
    if (new Date() > eventGroup.event.start_date_time) {
      return {
        success: false,
        error: 'Cannot submit RSVP - event has already started'
      };
    }

    // Check RSVP preferences and lock status
    const rsvpPreferencesResult = await getRsvpPreferencesForGroup(eventId, groupId);
    if (rsvpPreferencesResult.success && rsvpPreferencesResult.preferences) {
      const preferences = rsvpPreferencesResult.preferences;
      
      // Check if RSVP is locked
      if (!preferences.isRsvpAllowed) {
        return {
          success: false,
          error: `RSVP submission deadline has passed. Submissions were locked on ${preferences.rsvp_lock_date.toLocaleDateString()}`
        };
      }

      // Validate submitted data against preferences
      if (!preferences.collect_attendance && data.rsvp !== 'no_response') {
        return {
          success: false,
          error: 'RSVP attendance collection is disabled for this event'
        };
      }

      if (!preferences.collect_food && data.food) {
        return {
          success: false,
          error: 'Food preference collection is disabled for this event'
        };
      }

      if (!preferences.collect_alcohol && data.alcohol) {
        return {
          success: false,
          error: 'Alcohol preference collection is disabled for this event'
        };
      }

      if (!preferences.collect_accommodation && data.accommodation) {
        return {
          success: false,
          error: 'Accommodation preference collection is disabled for this group'
        };
      }

      if (!preferences.collect_guest_count && data.count && data.count > 1) {
        return {
          success: false,
          error: 'Guest count collection is disabled for this event'
        };
      }
    }

    // Use transaction to handle RSVP submission
    const result = await prisma.$transaction(async (tx) => {
      if (authenticatedUserId) {
        // ===== AUTHENTICATED USER FLOW (APP) =====
        let user = await tx.user.findUnique({
          where: { id: authenticatedUserId }
        });
        
        if (!user) {
          throw new Error('Authenticated user not found');
        }

        // Update user details if they provided new information
        if (data.name !== user.name || data.email !== user.email) {
          user = await tx.user.update({
            where: { id: authenticatedUserId },
            data: {
              ...(data.name && data.name !== user.name && { name: data.name }),
              ...(data.email && data.email !== user.email && { email: data.email })
            }
          });
        }

        // Check if guest record already exists for this user, event, and group
        const existingGuest = await tx.guest.findFirst({
          where: {
            user_id: user.id,
            event_id: eventId,
            group_id: groupId
          }
        });

        if (existingGuest) {
          // Update existing guest record
          const updatedGuest = await tx.guest.update({
            where: { id: existingGuest.id },
            data: {
              rsvp: data.rsvp,
              ...(data.food && { food: data.food }),
              ...(data.alcohol && { alcohol: data.alcohol }),
              ...(data.accommodation && { accommodation: data.accommodation }),
              ...(data.count && { count: data.count }),
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
              },
              event: { 
                select: { 
                  id: true, 
                  title: true, 
                  start_date_time: true 
                } 
              },
              group: { select: { id: true, name: true } }
            }
          });

          return { 
            guest: updatedGuest, 
            user, 
            isNewUser: false, 
            wasAuthenticated: true,
            isWebSubmission: false
          };
        } else {
          // Create new guest record
          const newGuest = await tx.guest.create({
            data: {
              user_id: user.id,
              event_id: eventId,
              group_id: groupId,
              rsvp: data.rsvp,
              count: data.count || 1,
              ...(data.food && { food: data.food }),
              ...(data.alcohol && { alcohol: data.alcohol }),
              ...(data.accommodation && { accommodation: data.accommodation }),
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
              },
              event: { 
                select: { 
                  id: true, 
                  title: true, 
                  start_date_time: true 
                } 
              },
              group: { select: { id: true, name: true } }
            }
          });

          return { 
            guest: newGuest, 
            user, 
            isNewUser: false, 
            wasAuthenticated: true,
            isWebSubmission: false
          };
        }
      } else {
        // ===== ANONYMOUS WEB USER FLOW =====
        
        // Check if there's already an unlinked RSVP for this phone number, event, and group
        const existingUnlinkedGuest = await tx.guest.findFirst({
          where: {
            user_id: null,
            phone_no: data.phone_no,
            event_id: eventId,
            group_id: groupId
          }
        });

        if (existingUnlinkedGuest) {
          // Do not allow updates via web; instruct user to use the app
          return {
            guest: existingUnlinkedGuest,
            user: null,
            isNewUser: false,
            wasAuthenticated: false,
            isWebSubmission: true,
            alreadySubmitted: true
          };
        } else {
          // Create new unlinked guest record for web submission
          const newGuest = await tx.guest.create({
            data: {
              user_id: null, // Unlinked for web submissions
              event_id: eventId,
              group_id: groupId,
              name: data.name,
              phone_no: data.phone_no,
              email: data.email,
              rsvp: data.rsvp,
              count: data.count || 1,
              ...(data.food && { food: data.food }),
              ...(data.alcohol && { alcohol: data.alcohol }),
              ...(data.accommodation && { accommodation: data.accommodation }),
            },
            include: {
              event: { 
                select: { 
                  id: true, 
                  title: true, 
                  start_date_time: true 
                } 
              },
              group: { select: { id: true, name: true } }
            }
          });

          return { 
            guest: newGuest, 
            user: null, 
            isNewUser: true, 
            wasAuthenticated: false,
            isWebSubmission: true,
            alreadySubmitted: false
          };
        }
      }
    });

    // Generate appropriate response message
    let message = '';
    if (result.isWebSubmission) {
      if (result.alreadySubmitted) {
        message = 'You have already submitted your RSVP. Download our app to view or update it.';
      } else {
        const rsvpMessages: Record<RSVP, string> = {
          accepted: 'Great! Your RSVP has been confirmed. Download our app to manage all your event RSVPs and get updates!',
          declined: 'Thanks for letting us know. Download our app to stay updated on future events!',
          maybe: 'Thanks for your response! Download our app to update your RSVP anytime and manage all your events!',
          no_response: 'Thanks! Your response has been recorded. Download our app to manage all your event RSVPs and get updates!',
          failed_delivery: 'We received your submission, but there was an issue delivering the response. Download our app for updates and to manage your RSVP.'
        };
        message = rsvpMessages[data.rsvp] || 'RSVP submitted successfully! Download our app for the full experience.';
      }
    } else {
      message = result.isNewUser ? 'RSVP submitted successfully' : 'RSVP updated successfully';
    }

    return {
      success: true,
      guest: result.guest,
      user: result.user,
      message,
      wasAuthenticated: result.wasAuthenticated,
      isWebSubmission: result.isWebSubmission,
      showAppDownload: result.isWebSubmission
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to submit RSVP'
    };
  }
};

// Get RSVP status for a phone number in a specific event and group (public endpoint)
export const getGroupRsvpStatus = async (eventId: string, groupId: string, phoneNo: string) => {
  try {
    // Verify the event and group association first
    const eventGroup = await prisma.eventGuestGroup.findFirst({
      where: { 
        event_id: eventId,
        guest_group_id: groupId 
      }
    });

    if (!eventGroup) {
      return {
        success: false,
        error: 'Group not found or not associated with this event'
      };
    }

    // First check for linked user
    const user = await getUserByPhoneNumber(phoneNo);
    if (user) {
      const guest = await prisma.guest.findFirst({
        where: {
          user_id: user.id,
          event_id: eventId,
          group_id: groupId
        },
        select: {
          id: true,
          rsvp: true,
          food: true,
          alcohol: true,
          accommodation: true,
          count: true,
          user: {
            select: {
              name: true,
              mobile_number: true,
              email: true
            }
          },
          event: {
            select: {
              id: true,
              title: true,
              start_date_time: true
            }
          }
        }
      });

      if (guest) {
        return {
          success: true,
          guest
        };
      }
    }

    // Check for unlinked guest (web submission)
    const unlinkedGuest = await prisma.guest.findFirst({
      where: {
        user_id: null,
        phone_no: phoneNo,
        event_id: eventId,
        group_id: groupId
      },
      select: {
        id: true,
        name: true,
        phone_no: true,
        email: true,
        rsvp: true,
        food: true,
        alcohol: true,
        accommodation: true,
        count: true,
        event: {
          select: {
            id: true,
            title: true,
            start_date_time: true
          }
        }
      }
    });

    if (!unlinkedGuest) {
      return {
        success: false,
        error: 'No RSVP found for this phone number in this group'
      };
    }

    return {
      success: true,
      guest: unlinkedGuest
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get RSVP status'
    };
  }
};

// ===== PROTECTED RSVP ROUTES =====

// Get authenticated user's RSVP for a specific event (protected)
export const getUserRsvpForEvent = async (userId: string, eventId: string) => {
  try {
    const guest = await prisma.guest.findFirst({
      where: {
        user_id: userId,
        event_id: eventId
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
        },
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
            invite_message: true
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
        error: 'No RSVP found for this user and event'
      };
    }

    return {
      success: true,
      rsvp: guest
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get user RSVP'
    };
  }
};

// Update authenticated user's RSVP for a specific event (protected)
export const updateUserRsvp = async (
  userId: string, 
  eventId: string, 
  data: {
    rsvp: RSVP;
    food?: string;
    alcohol?: string;
    accommodation?: string;
    count?: number;
  }
) => {
  try {
    // Check if event exists and hasn't passed
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        title: true,
        start_date_time: true
      }
    });

    if (!event) {
      return {
        success: false,
        error: 'Event not found'
      };
    }

    // Check if event has passed
    if (new Date() > event.start_date_time) {
      return {
        success: false,
        error: 'Cannot update RSVP - event has already started'
      };
    }

    // Find existing guest record
    const existingGuest = await prisma.guest.findFirst({
      where: {
        user_id: userId,
        event_id: eventId
      }
    });

    if (!existingGuest) {
      return {
        success: false,
        error: 'No RSVP found to update. Please submit an RSVP first.'
      };
    }

    // Update the guest record
    const updatedGuest = await prisma.guest.update({
      where: { id: existingGuest.id },
      data: {
        rsvp: data.rsvp,
        ...(data.food !== undefined && { food: data.food }),
        ...(data.alcohol !== undefined && { alcohol: data.alcohol }),
        ...(data.accommodation !== undefined && { accommodation: data.accommodation }),
        ...(data.count !== undefined && { count: data.count }),
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
        },
        event: {
          select: {
            id: true,
            title: true,
            type: true,
            location: true,
            address: true,
            start_date_time: true,
            end_date_time: true,
            image: true
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

    return {
      success: true,
      rsvp: updatedGuest,
      message: 'RSVP updated successfully'
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update RSVP'
    };
  }
};

// Get authenticated user's RSVP by event ID and group ID (protected)
export const getUserRsvpByGroup = async (userId: string, eventId: string, groupId: string) => {
  try {
    // Verify the event and group association
    const eventGroup = await prisma.eventGuestGroup.findFirst({
      where: { 
        event_id: eventId,
        guest_group_id: groupId 
      }
    });

    if (!eventGroup) {
      return {
        success: false,
        error: 'Group not found or not associated with this event'
      };
    }

    const guest = await prisma.guest.findFirst({
      where: {
        user_id: userId,
        event_id: eventId,
        group_id: groupId
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
        },
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
            invite_message: true
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
        error: 'No RSVP found for this user in this group'
      };
    }

    return {
      success: true,
      rsvp: guest
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get user RSVP'
    };
  }
};

// ===== BULK INVITE MANAGEMENT =====

// Bulk create invites for WhatsApp/Excel imports
export const bulkCreateInvites = async (eventId: string, invitesData: Array<{
  name: string;
  phone_no: string;
  group_id: string;
  email?: string;
}>) => {
  try {
    const created: any[] = [];
    const failed: any[] = [];

    for (const inviteData of invitesData) {
      try {
        // Check if invite already exists for this phone + event
        const existingInvite = await prisma.invite.findUnique({
          where: {
            phone_no_event_id: {
              phone_no: inviteData.phone_no,
              event_id: eventId,
            },
          },
        });

        if (existingInvite) {
          failed.push({
            ...inviteData,
            reason: 'Invite already exists for this phone number and event',
          });
          continue;
        }

        const invite = await prisma.invite.create({
          data: {
            name: inviteData.name,
            phone_no: inviteData.phone_no,
            email: inviteData.email,
            event_id: eventId,
            group_id: inviteData.group_id,
          },
        });

        created.push(invite);
      } catch (error) {
        failed.push({
          ...inviteData,
          reason: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      success: true,
      created,
      failed,
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
        error: 'Failed to create invites',
      };
    }
  }
};

// ===== HOST/CO-HOST ENDPOINTS =====

// Get all RSVPs for a user across events (protected)
export const getUserRsvps = async (userId: string) => {
  try {
    const guests = await prisma.guest.findMany({
      where: {
        user_id: userId,
        rsvp: {
          not: 'no_response'
        }
      },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            type: true,
            location: true,
            start_date_time: true,
            end_date_time: true,
            image: true
          }
        },
        group: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        event: {
          start_date_time: 'asc'
        }
      }
    });

    return {
      success: true,
      rsvps: guests
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get user RSVPs'
    };
  }
};

// Get RSVP summary for event (host/co-host only)
export const getEventRsvpSummary = async (eventId: string, userId: string) => {
  try {
    // Verify user is host or co-host
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        hostId: true,
        co_hosts: { select: { id: true } }
      }
    });

    if (!event) {
      return {
        success: false,
        error: 'Event not found'
      };
    }

    const isHost = event.hostId === userId;
    const isCoHost = event.co_hosts.some(coHost => coHost.id === userId);

    if (!isHost && !isCoHost) {
      return {
        success: false,
        error: 'Access denied. Only hosts and co-hosts can view RSVP summary'
      };
    }

    const summary = await prisma.guest.groupBy({
      by: ['rsvp', 'food', 'alcohol', 'accommodation'],
      where: { event_id: eventId },
      _count: { _all: true },
      _sum: { count: true }
    });

    const totalGuests = await prisma.guest.aggregate({
      where: { event_id: eventId },
      _sum: { count: true },
      _count: { _all: true }
    });

    return {
      success: true,
      summary,
      totalInvited: totalGuests._count,
      totalConfirmed: totalGuests._sum.count || 0
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get RSVP summary'
    };
  }
};

// Get detailed guest list for event (host/co-host only)
export const getEventGuestList = async (eventId: string, userId: string, filters?: {
  rsvp?: RSVP;
  food?: string;
  alcohol?: string;
  accommodation?: string;
  groupId?: string;
  includeUnlinked?: boolean;
}) => {
  try {
    // Verify user is host or co-host
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        hostId: true,
        co_hosts: { select: { id: true } }
      }
    });

    if (!event) {
      return {
        success: false,
        error: 'Event not found'
      };
    }

    const isHost = event.hostId === userId;
    const isCoHost = event.co_hosts.some(coHost => coHost.id === userId);

    if (!isHost && !isCoHost) {
      return {
        success: false,
        error: 'Access denied. Only hosts and co-hosts can view guest list'
      };
    }

    const whereClause: any = {
      event_id: eventId,
      ...(filters?.rsvp && { rsvp: filters.rsvp }),
      ...(filters?.food && { food: filters.food }),
      ...(filters?.alcohol && { alcohol: filters.alcohol }),
      ...(filters?.accommodation && { accommodation: filters.accommodation }),
      ...(filters?.groupId && { group_id: filters.groupId }),
    };

    // If includeUnlinked is false, only show linked guests
    if (filters?.includeUnlinked === false) {
      whereClause.user_id = { not: null };
    }

    const guests = await prisma.guest.findMany({
      where: whereClause,
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
        { name: 'asc' } // For unlinked guests
      ]
    });

    // Separate linked and unlinked guests for better organization
    const linkedGuests = guests.filter(guest => guest.user_id !== null);
    const unlinkedGuests = guests.filter(guest => guest.user_id === null);

    return {
      success: true,
      guests,
      linkedGuests,
      unlinkedGuests,
      summary: {
        total: guests.length,
        linked: linkedGuests.length,
        unlinked: unlinkedGuests.length
      }
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get guest list'
    };
  }
};