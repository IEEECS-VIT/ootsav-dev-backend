import { PrismaClient } from '@prisma/client';
import { isEventHostOrCoHost } from './guestService';

const prisma = new PrismaClient();

export interface RsvpPreferencesData {
  rsvp_lock_date: string;
  collect_attendance: boolean;
  collect_guest_count: boolean;
  collect_food: boolean;
  collect_alcohol: boolean;
  additional_notes?: string;
  group_preferences?: {
    group_id: string;
    collect_accommodation: boolean;
    accommodation_details?: string;
    collect_transport: boolean;
    transport_details?: string;
    additional_notes?: string;
  }[];
}

// Set RSVP preferences for an event (with group-specific settings)
export const setEventRsvpPreferences = async (
  eventId: string, 
  userId: string, 
  data: RsvpPreferencesData
) => {
  try {
    // Verify user is host or co-host
    const isAuthorized = await isEventHostOrCoHost(userId, eventId);
    if (!isAuthorized) {
      return {
        success: false,
        error: 'Only event hosts and co-hosts can set RSVP preferences'
      };
    }

    // Verify event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true }
    });

    if (!event) {
      return {
        success: false,
        error: 'Event not found'
      };
    }

    // Validate rsvp_lock_date is in the future
    const lockDate = new Date(data.rsvp_lock_date);
    if (lockDate <= new Date()) {
      return {
        success: false,
        error: 'RSVP lock date must be in the future'
      };
    }

    const result = await prisma.$transaction(async (tx) => {
      // Delete existing preferences for this event
      await tx.rsvpPreferences.deleteMany({
        where: { event_id: eventId }
      });

      // Create global preferences (applies to all groups unless overridden)
      const globalPreferences = await tx.rsvpPreferences.create({
        data: {
          event_id: eventId,
          group_id: null, // null means applies to all groups by default
          rsvp_lock_date: lockDate,
          collect_attendance: data.collect_attendance,
          collect_guest_count: data.collect_guest_count,
          collect_food: data.collect_food,
          collect_alcohol: data.collect_alcohol,
          collect_accommodation: false, // Global default
          collect_transport: false, // Global default
          additional_notes: data.additional_notes
        }
      });

      // Create group-specific preferences if provided
      const groupPreferences = [];
      if (data.group_preferences && data.group_preferences.length > 0) {
        for (const groupPref of data.group_preferences) {
          // Verify group exists and is associated with this event
          const groupExists = await tx.eventGuestGroup.findUnique({
            where: {
              event_id_guest_group_id: {
                event_id: eventId,
                guest_group_id: groupPref.group_id
              }
            }
          });

          if (!groupExists) {
            throw new Error(`Group ${groupPref.group_id} not found or not associated with this event`);
          }

          const groupPreference = await tx.rsvpPreferences.create({
            data: {
              event_id: eventId,
              group_id: groupPref.group_id,
              rsvp_lock_date: lockDate, // Same lock date for all groups
              collect_attendance: data.collect_attendance, // Inherit from global
              collect_guest_count: data.collect_guest_count, // Inherit from global
              collect_food: data.collect_food, // Inherit from global
              collect_alcohol: data.collect_alcohol, // Inherit from global
              collect_accommodation: groupPref.collect_accommodation,
              accommodation_details: groupPref.accommodation_details,
              collect_transport: groupPref.collect_transport,
              transport_details: groupPref.transport_details,
              additional_notes: groupPref.additional_notes || data.additional_notes
            }
          });

          groupPreferences.push(groupPreference);
        }
      }

      return {
        globalPreferences,
        groupPreferences
      };
    });

    return {
      success: true,
      preferences: result,
      message: 'RSVP preferences set successfully'
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to set RSVP preferences'
    };
  }
};

// Get RSVP preferences for a specific event and group
export const getRsvpPreferencesForGroup = async (
  eventId: string, 
  groupId: string
) => {
  try {
    // First try to get group-specific preferences
    let preferences: any = await prisma.rsvpPreferences.findUnique({
      where: {
        event_id_group_id: {
          event_id: eventId,
          group_id: groupId
        }
      },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            start_date_time: true
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

    // If no group-specific preferences, fall back to global preferences
    if (!preferences) {
      preferences = await prisma.rsvpPreferences.findFirst({
        where: {
          event_id: eventId,
          group_id: null // Global preferences
        },
        include: {
          event: {
            select: {
              id: true,
              title: true,
              start_date_time: true
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
    }

    if (!preferences) {
      return {
        success: false,
        error: 'No RSVP preferences found for this event'
      };
    }

    // Check if RSVP is still allowed (before lock date)
    const isRsvpAllowed = new Date() < preferences.rsvp_lock_date;

    return {
      success: true,
      preferences: {
        ...preferences,
        isRsvpAllowed,
        daysUntilLock: Math.ceil(
          (preferences.rsvp_lock_date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        )
      }
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get RSVP preferences'
    };
  }
};

// Get all RSVP preferences for an event (host/co-host only)
export const getEventRsvpPreferences = async (
  eventId: string, 
  userId: string
) => {
  try {
    // Verify user is host or co-host
    const isAuthorized = await isEventHostOrCoHost(userId, eventId);
    if (!isAuthorized) {
      return {
        success: false,
        error: 'Only event hosts and co-hosts can view RSVP preferences'
      };
    }

    const preferences = await prisma.rsvpPreferences.findMany({
      where: { event_id: eventId },
      include: {
        group: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: [
        { group_id: { sort: 'asc', nulls: 'first' } }, // Global preferences first
        { group: { name: 'asc' } }
      ]
    });

    if (preferences.length === 0) {
      return {
        success: false,
        error: 'No RSVP preferences configured for this event'
      };
    }

    // Separate global and group-specific preferences
    const globalPreferences = preferences.find(p => p.group_id === null);
    const groupPreferences = preferences.filter(p => p.group_id !== null);

    return {
      success: true,
      globalPreferences,
      groupPreferences,
      allPreferences: preferences
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get event RSVP preferences'
    };
  }
};

// Update RSVP preferences for an event
export const updateEventRsvpPreferences = async (
  eventId: string,
  userId: string,
  data: Partial<RsvpPreferencesData>
) => {
  try {
    // Verify user is host or co-host
    const isAuthorized = await isEventHostOrCoHost(userId, eventId);
    if (!isAuthorized) {
      return {
        success: false,
        error: 'Only event hosts and co-hosts can update RSVP preferences'
      };
    }

    // If updating lock date, validate it's in the future
    if (data.rsvp_lock_date) {
      const lockDate = new Date(data.rsvp_lock_date);
      if (lockDate <= new Date()) {
        return {
          success: false,
          error: 'RSVP lock date must be in the future'
        };
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // Update global preferences if they exist
      const globalPreferences = await tx.rsvpPreferences.findFirst({
        where: {
          event_id: eventId,
          group_id: null
        }
      });

      if (globalPreferences && data.rsvp_lock_date !== undefined) {
        await tx.rsvpPreferences.update({
          where: { id: globalPreferences.id },
          data: {
            ...(data.rsvp_lock_date && { rsvp_lock_date: new Date(data.rsvp_lock_date) }),
            ...(data.collect_attendance !== undefined && { collect_attendance: data.collect_attendance }),
            ...(data.collect_guest_count !== undefined && { collect_guest_count: data.collect_guest_count }),
            ...(data.collect_food !== undefined && { collect_food: data.collect_food }),
            ...(data.collect_alcohol !== undefined && { collect_alcohol: data.collect_alcohol }),
            ...(data.additional_notes !== undefined && { additional_notes: data.additional_notes }),
          }
        });
      }

      // Update group-specific preferences if provided
      if (data.group_preferences) {
        for (const groupPref of data.group_preferences) {
          await tx.rsvpPreferences.upsert({
            where: {
              event_id_group_id: {
                event_id: eventId,
                group_id: groupPref.group_id
              }
            },
            update: {
              collect_accommodation: groupPref.collect_accommodation,
              accommodation_details: groupPref.accommodation_details,
              collect_transport: groupPref.collect_transport,
              transport_details: groupPref.transport_details,
              additional_notes: groupPref.additional_notes
            },
            create: {
              event_id: eventId,
              group_id: groupPref.group_id,
              rsvp_lock_date: data.rsvp_lock_date ? new Date(data.rsvp_lock_date) : new Date(),
              collect_attendance: data.collect_attendance ?? true,
              collect_guest_count: data.collect_guest_count ?? true,
              collect_food: data.collect_food ?? false,
              collect_alcohol: data.collect_alcohol ?? false,
              collect_accommodation: groupPref.collect_accommodation,
              accommodation_details: groupPref.accommodation_details,
              collect_transport: groupPref.collect_transport,
              transport_details: groupPref.transport_details,
              additional_notes: groupPref.additional_notes
            }
          });
        }
      }

      return true;
    });

    return {
      success: true,
      message: 'RSVP preferences updated successfully'
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update RSVP preferences'
    };
  }
};

// Delete RSVP preferences for an event
export const deleteEventRsvpPreferences = async (
  eventId: string,
  userId: string
) => {
  try {
    // Verify user is host or co-host
    const isAuthorized = await isEventHostOrCoHost(userId, eventId);
    if (!isAuthorized) {
      return {
        success: false,
        error: 'Only event hosts and co-hosts can delete RSVP preferences'
      };
    }

    await prisma.rsvpPreferences.deleteMany({
      where: { event_id: eventId }
    });

    return {
      success: true,
      message: 'RSVP preferences deleted successfully'
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete RSVP preferences'
    };
  }
};