import { PrismaClient, RSVP } from '@prisma/client';
import { getUserByPhoneNumber } from './userService';
import { isEventHostOrCoHost } from './guestService';
import { getRsvpPreferencesForGroup } from './rsvpPreferencesService';
import { sendWhatsappMessage } from './twilioService';

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
    const inviteLink = `https://ootsav.in/invite/?eventId=${eventId}&groupId=${groupId}`;

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
            otherDetails: true,
            // Add co-hosts and sub-events to the event payload
            co_hosts: {
              select: {
                id: true,
                name: true,
                mobile_number: true,
                profile_pic: true
              }
            },
            sub_events: {
              select: {
                id: true,
                title: true,
                location: true,
                address: true,
                invite_message: true,
                image: true,
                start_date_time: true,
                end_date_time: true
              }
            }
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
          pickup_date_time: true,
          pickup_location: true,
          dropoff_date_time: true,
          dropoff_location: true,
          count: true,
          personal_note: true
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
    alcohol?: boolean;
    pickup_date_time?: Date;
    pickup_location?: string;
    dropoff_date_time?: Date;
    dropoff_location?: string;
    count?: number;
    personal_note?: string;
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
        const lockDateString = preferences.rsvp_lock_date 
          ? preferences.rsvp_lock_date.toLocaleDateString()
          : 'an earlier date';
        
        return {
          success: false,
          error: `RSVP submission deadline has passed. Submissions were locked on ${lockDateString}`
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
              name: data.name || user.name,
              phone_no: data.phone_no || user.mobile_number,
              email: data.email || user.email,
              ...(data.food && { food: data.food }),
              ...(typeof data.alcohol === 'boolean' && { alcohol: data.alcohol }),
              ...(data.personal_note !== undefined && { personal_note: data.personal_note }),
              ...(data.pickup_date_time && { pickup_date_time: data.pickup_date_time }),
              ...(data.pickup_location && { pickup_location: data.pickup_location }),
              ...(data.dropoff_date_time && { dropoff_date_time: data.dropoff_date_time }),
              ...(data.dropoff_location && { dropoff_location: data.dropoff_location }),
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
              name: data.name,
              phone_no: data.phone_no,
              email: data.email,
              rsvp: data.rsvp,
              count: data.count || 1,
              ...(data.food && { food: data.food }),
              ...(typeof data.alcohol === 'boolean' && { alcohol: data.alcohol }),
              ...(data.personal_note && { personal_note: data.personal_note }),
              ...(data.pickup_date_time && { pickup_date_time: data.pickup_date_time }),
              ...(data.pickup_location && { pickup_location: data.pickup_location }),
              ...(data.dropoff_date_time && { dropoff_date_time: data.dropoff_date_time }),
              ...(data.dropoff_location && { dropoff_location: data.dropoff_location }),
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

          // Update existing unlinked guest record
          const updatedGuest = await tx.guest.update({
            where: { id: existingUnlinkedGuest.id },
            data: {
              rsvp: data.rsvp,
              name: data.name,
              email: data.email,
              ...(data.food && { food: data.food }),
              ...(typeof data.alcohol === 'boolean' && { alcohol: data.alcohol }),
              ...(data.personal_note !== undefined && { personal_note: data.personal_note }),
              ...(data.pickup_date_time && { pickup_date_time: data.pickup_date_time }),
              ...(data.pickup_location && { pickup_location: data.pickup_location }),
              ...(data.dropoff_date_time && { dropoff_date_time: data.dropoff_date_time }),
              ...(data.dropoff_location && { dropoff_location: data.dropoff_location }),
              ...(data.count && { count: data.count }),
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
            guest: updatedGuest,
            user: null,
            isNewUser: false,
            wasAuthenticated: false,
            isWebSubmission: true,
            alreadySubmitted: false
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
              ...(typeof data.alcohol === 'boolean' && { alcohol: data.alcohol }),
              ...(data.personal_note && { personal_note: data.personal_note }),
              ...(data.pickup_date_time && { pickup_date_time: data.pickup_date_time }),
              ...(data.pickup_location && { pickup_location: data.pickup_location }),
              ...(data.dropoff_date_time && { dropoff_date_time: data.dropoff_date_time }),
              ...(data.dropoff_location && { dropoff_location: data.dropoff_location }),
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
          personal_note: true,
          pickup_date_time: true,
          pickup_location: true,
          dropoff_date_time: true,
          dropoff_location: true,
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
        personal_note: true,
        pickup_date_time: true,
        pickup_location: true,
        dropoff_date_time: true,
        dropoff_location: true,
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
    alcohol?: boolean; // Changed from string to boolean
    pickup_date_time?: Date;
    pickup_location?: string;
    dropoff_date_time?: Date;
    dropoff_location?: string;
    count?: number;
    name?: string;
    email?: string;
    phone_no?: string;
    personal_note?: string;
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

    // In the update operation, replace accommodation with new fields:
    const updateData: any = {
      rsvp: data.rsvp,
      ...(data.name && { name: data.name }),
      ...(data.email && { email: data.email }),
      ...(data.phone_no && { phone_no: data.phone_no }),
    };

    if (data.food !== undefined) updateData.food = data.food;
    if (data.alcohol !== undefined) updateData.alcohol = data.alcohol;
    if (data.personal_note !== undefined) updateData.personal_note = data.personal_note;
    if (data.pickup_date_time !== undefined) updateData.pickup_date_time = data.pickup_date_time;
    if (data.pickup_location !== undefined) updateData.pickup_location = data.pickup_location;
    if (data.dropoff_date_time !== undefined) updateData.dropoff_date_time = data.dropoff_date_time;
    if (data.dropoff_location !== undefined) updateData.dropoff_location = data.dropoff_location;
    if (data.count !== undefined) updateData.count = data.count;

    // Update the guest record
    const updatedGuest = await prisma.guest.update({
      where: { id: existingGuest.id },
      data: updateData,
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

export const sendWhatsappInviteWithTwilio = async (
  senderUserId: string,
  eventId: string,
  groupId: string,
  name: string,
  phone_no: string
) => {
  try {
      console.log('[inviteService.sendWhatsappInviteWithTwilio] Starting invite process for', { senderUserId, eventId, groupId, name, phone_no });
      // Verify user is host or co-host
      const isAuthorized = await isEventHostOrCoHost(senderUserId, eventId);
      console.log('[inviteService.sendWhatsappInviteWithTwilio] Is user authorized:', isAuthorized);
      if (!isAuthorized) {
          return {
              success: false,
              error: 'Access denied. Only hosts and co-hosts can send invites.'
          };
      }

      // Step 1: Generate the unique invite link for the group.
      const linkResult = await generateGroupInviteLink(eventId, groupId);
      console.log('[inviteService.sendWhatsappInviteWithTwilio] Generated link result:', linkResult);
      if (!linkResult.success || !linkResult.inviteLink) {
          throw new Error(linkResult.error || 'Failed to generate invite link.');
      }

      // Step 2: Create the personalized message.
      const eventName = linkResult.event?.title || 'an event';
      const message = `Hello ${name}, you are invited to ${eventName}. Please RSVP here: ${linkResult.inviteLink}`;
      console.log('[inviteService.sendWhatsappInviteWithTwilio] Sending message:', message);

      // Step 3: Use twilio to send the message.
      const sendResult = await sendWhatsappMessage(phone_no, message);
      console.log('[inviteService.sendWhatsappInviteWithTwilio] Twilio send result:', sendResult);

      if (!sendResult.success) {
          // If sending fails, update the invite record to show failed delivery.
          await prisma.invite.upsert({
              where: {
                  phone_no_event_id: {
                      phone_no: phone_no,
                      event_id: eventId,
                  },
              },
              update: {
                  message_status: 'failed_delivery',
              },
              create: {
                  name: name,
                  phone_no: phone_no,
                  event_id: eventId,
                  group_id: groupId,
                  message_status: 'failed_delivery',
              }
          });
          throw new Error('Failed to send WhatsApp message via Twilio.');
      }

      // Step 4: Create or update an invite record to mark as delivered.
      console.log('[inviteService.sendWhatsappInviteWithTwilio] Upserting invite record as delivered');
      await prisma.invite.upsert({
          where: {
              phone_no_event_id: {
                  phone_no: phone_no,
                  event_id: eventId,
              },
          },
          update: {
              message_status: 'delivered',
          },
          create: {
              name: name,
              phone_no: phone_no,
              event_id: eventId,
              group_id: groupId,
              message_status: 'delivered',
          }
      });

      console.log('[inviteService.sendWhatsappInviteWithTwilio] Invite process successful');
      return { success: true };
  } catch (error: any) {
      console.error('[inviteService.sendWhatsappInviteWithTwilio] Error:', error);
      return { success: false, error: error.message || 'Failed to send WhatsApp invite' };
  }
};

// ===== BULK INVITE MANAGEMENT =====

// Create guest records without sending WhatsApp messages
export const createGuestsWithoutSending = async (
  senderUserId: string,
  eventId: string,
  groupId: string,
  invitesList: Array<{ name: string; phone_no: string }>
) => {
  try {
    console.log('[inviteService.createGuestsWithoutSending] Creating guest records for', invitesList.length, 'invites');

    // Verify user is host or co-host
    const isAuthorized = await isEventHostOrCoHost(senderUserId, eventId);
    if (!isAuthorized) {
      return {
        success: false,
        error: 'Access denied. Only hosts and co-hosts can create invites.',
        created: [],
        failed: []
      };
    }

    const created: any[] = [];
    const failed: any[] = [];

    for (const invite of invitesList) {
      try {
        // Check if guest already exists for this phone + event
        const existingGuest = await prisma.guest.findFirst({
          where: {
            phone_no: invite.phone_no,
            event_id: eventId,
          },
        });

        if (existingGuest) {
          failed.push({
            ...invite,
            reason: 'Guest already exists for this phone number and event',
          });
          continue;
        }

        // Create guest record with no_response RSVP status
        const guest = await prisma.guest.create({
          data: {
            name: invite.name,
            phone_no: invite.phone_no,
            event_id: eventId,
            group_id: groupId,
            rsvp: 'no_response',
          },
        });

        created.push({ name: guest.name, phone_no: guest.phone_no, id: guest.id });
      } catch (error) {
        failed.push({
          ...invite,
          reason: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      success: true,
      created,
      failed,
    };
  } catch (error: any) {
    console.error('[inviteService.createGuestsWithoutSending] Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to create guest records',
      created: [],
      failed: []
    };
  }
};

// Send WhatsApp messages to all no_response guests in a group
export const sendWhatsappToNoResponseGuests = async (
  senderUserId: string,
  eventId: string,
  groupId: string
) => {
  try {
    console.log('[inviteService.sendWhatsappToNoResponseGuests] Starting process for', { eventId, groupId });

    // Verify user is host or co-host
    const isAuthorized = await isEventHostOrCoHost(senderUserId, eventId);
    if (!isAuthorized) {
      return {
        success: false,
        error: 'Access denied. Only hosts and co-hosts can send invites.',
        sent: [],
        failed: []
      };
    }

    // Get all guests with no_response status for this event and group
    const noResponseGuests = await prisma.guest.findMany({
      where: {
        event_id: eventId,
        group_id: groupId,
        rsvp: 'no_response',
        phone_no: { not: null }, // Only get guests with phone numbers
      },
      select: {
        id: true,
        name: true,
        phone_no: true,
      },
    });

    console.log('[inviteService.sendWhatsappToNoResponseGuests] Found', noResponseGuests.length, 'guests with no_response');

    if (noResponseGuests.length === 0) {
      return {
        success: true,
        sent: [],
        failed: [],
        noGuestsFound: true,
        message: 'No guests with no_response status found for this group',
      };
    }

    // Generate the invite link
    const linkResult = await generateGroupInviteLink(eventId, groupId);
    if (!linkResult.success || !linkResult.inviteLink) {
      return {
        success: false,
        error: linkResult.error || 'Failed to generate invite link',
        sent: [],
        failed: []
      };
    }

    const eventName = linkResult.event?.title || 'an event';
    const sent: any[] = [];
    const failed: any[] = [];

    // Send WhatsApp message to each guest
    for (const guest of noResponseGuests) {
      try {
        // Skip guests without phone numbers (already filtered but double-check)
        if (!guest.phone_no) {
          failed.push({
            name: guest.name,
            phone_no: 'N/A',
            error: 'Phone number not available',
          });
          continue;
        }

        const message = `Hello ${guest.name}, you are invited to ${eventName}. Please RSVP here: ${linkResult.inviteLink}`;
        const sendResult = await sendWhatsappMessage(guest.phone_no, message);

        if (sendResult.success) {
          sent.push({ name: guest.name, phone_no: guest.phone_no, id: guest.id });
          console.log('[inviteService.sendWhatsappToNoResponseGuests] Sent to', guest.name);
        } else {
          failed.push({ name: guest.name, phone_no: guest.phone_no, error: sendResult.error });
          console.log('[inviteService.sendWhatsappToNoResponseGuests] Failed to send to', guest.name, ':', sendResult.error);
        }
      } catch (error) {
        failed.push({
          name: guest.name,
          phone_no: guest.phone_no,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      success: true,
      sent,
      failed,
      noGuestsFound: false,
    };
  } catch (error: any) {
    console.error('[inviteService.sendWhatsappToNoResponseGuests] Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to send WhatsApp messages',
      sent: [],
      failed: []
    };
  }
};

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

export const getEventRsvps = async (eventId: string, userId: string) => {
  try {
    // Verify user is host or co-host
    const isAuthorized = await isEventHostOrCoHost(userId, eventId);
    if (!isAuthorized) {
      return {
        success: false,
        error: 'Access denied. Only hosts and co-hosts can view RSVPs.'
      };
    }

    const guests = await prisma.guest.findMany({
      where: { event_id: eventId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            mobile_number: true,
            email: true,
            profile_pic: true
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
        name: 'asc'
      }
    });

    return {
      success: true,
      rsvps: guests
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get event RSVPs'
    };
  }
};

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

    // Update groupBy to remove accommodation
    const summary = await prisma.guest.groupBy({
      where: { event_id: eventId },
      by: ['rsvp', 'food', 'alcohol'],
      _count: {
        id: true,
        count: true
      }
    });

    const totalGuests = await prisma.guest.aggregate({
      where: { event_id: eventId },
      _sum: { count: true },
      _count: { _all: true }
    });

    // Count no_response explicitly
    const noResponseCount = await prisma.guest.count({
      where: { event_id: eventId, rsvp: 'no_response' }
    });

    return {
      success: true,
      summary,
      totalInvited: totalGuests._count,
      totalConfirmed: totalGuests._sum.count || 0,
      noResponseCount
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

export const sendGroupWhatsappMessage = async (
  senderUserId: string,
  eventId: string,
  groupId: string,
  title: string | undefined,
  body: string,
  mediaUrl?: string,
) => {
  try {
    const isAuthorized = await isEventHostOrCoHost(senderUserId, eventId);
    if (!isAuthorized) {
      return { success: false, error: 'Unauthorized' };
    }

    const groupWithGuests = await prisma.guestGroup.findFirst({
      where: {
        id: groupId,
        events: {
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
            user: true,
          },
        },
      },
    });

    if (!groupWithGuests) {
      return { success: false, error: 'Group not found for this event.' };
    }

    const results = {
      sent: [] as any[],
      failed: [] as any[],
    };

    // Format the message with title if provided
    let messageBody = body;
    if (title) {
      messageBody = `*${title}*\n\n${body}`;
    }

    for (const guest of groupWithGuests.guests) {
      const phone_no = guest.phone_no || guest.user?.mobile_number;
      const name = guest.user?.name || guest.name;

      if (phone_no) {
        const result = await sendWhatsappMessage(phone_no, messageBody, mediaUrl);
        if (result.success) {
          results.sent.push({ name, phone_no });
        } else {
          results.failed.push({ name, phone_no, error: result.error });
        }
      } else {
        results.failed.push({ name: name || 'Unnamed Guest', error: 'Missing phone number' });
      }
    }

    return { success: true, results };
  } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      console.error('[inviteService.sendGroupWhatsappMessage] Error:', errorMessage);
      return { success: false, error: errorMessage };
  }
};
