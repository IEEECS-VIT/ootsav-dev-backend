import { PrismaClient } from '@prisma/client';
import { isEventHostOrCoHost } from './guestService';

const prisma = new PrismaClient();

export interface RsvpPreferencesData {
  // Global settings (applied to all groups)
  rsvp_lock_date: string;
  collect_food: boolean;
  collect_alcohol: boolean;
  global_additional_details?: string;
  
  // Group-specific settings
  group_preferences?: {
    group_id: string;
    allow_additional_guests: boolean;
    collect_accommodation: boolean;
    accommodation_details?: string;
    collect_transport: boolean;
    transport_details?: string;
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
      // Get ALL groups associated with this event
      const allGroups = await tx.eventGuestGroup.findMany({
        where: { event_id: eventId }
      });

      if (allGroups.length === 0) {
        throw new Error('No groups found for this event');
      }

      const updatedGroups = [];

      // Update ALL groups with global settings first
      for (const group of allGroups) {
        // Find if this group has specific preferences
        const groupSpecificPrefs = data.group_preferences?.find(
          gp => gp.group_id === group.guest_group_id
        );

        const updatedGroup = await tx.eventGuestGroup.update({
          where: {
            event_id_guest_group_id: {
              event_id: eventId,
              guest_group_id: group.guest_group_id
            }
          },
          data: {
            // Global settings (applied to ALL groups)
            rsvp_lock_date: lockDate,
            collect_food: data.collect_food,
            collect_alcohol: data.collect_alcohol,
            global_additional_details: data.global_additional_details,
            
            // Group-specific settings (if provided, otherwise keep existing or set defaults)
            allow_additional_guests: groupSpecificPrefs?.allow_additional_guests ?? false,
            collect_accommodation: groupSpecificPrefs?.collect_accommodation ?? false,
            accommodation_details: groupSpecificPrefs?.accommodation_details ?? null,
            collect_transport: groupSpecificPrefs?.collect_transport ?? false,
            transport_details: groupSpecificPrefs?.transport_details ?? null,
          }
        });

        updatedGroups.push(updatedGroup);
      }

      // Verify all groups in group_preferences exist
      if (data.group_preferences && data.group_preferences.length > 0) {
        for (const groupPref of data.group_preferences) {
          const groupExists = allGroups.some(g => g.guest_group_id === groupPref.group_id);
          if (!groupExists) {
            throw new Error(`Group ${groupPref.group_id} not found or not associated with this event`);
          }
        }
      }

      return updatedGroups;
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

// Get RSVP preferences for an event
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

    const preferences = await prisma.eventGuestGroup.findMany({
      where: { event_id: eventId },
      include: {
        guestGroup: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        guestGroup: { name: 'asc' }
      }
    });

    if (preferences.length === 0) {
      return {
        success: false,
        error: 'No groups found for this event'
      };
    }

    // Extract global settings from first group (since they're same across all groups)
    const firstGroup = preferences[0];
    const globalSettings = {
      rsvp_lock_date: firstGroup.rsvp_lock_date,
      collect_food: firstGroup.collect_food,
      collect_alcohol: firstGroup.collect_alcohol,
      global_additional_details: firstGroup.global_additional_details
    };

    // Extract group-specific settings
    const groupPreferences = preferences.map(pref => ({
      group_id: pref.guest_group_id,
      group_name: pref.guestGroup.name,
      allow_additional_guests: pref.allow_additional_guests,
      collect_accommodation: pref.collect_accommodation,
      accommodation_details: pref.accommodation_details,
      collect_transport: pref.collect_transport,
      transport_details: pref.transport_details
    }));

    return {
      success: true,
      globalSettings,
      groupPreferences
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get event RSVP preferences'
    };
  }
};

// Get RSVP preferences for a specific group (NO AUTH REQUIRED)
export const getGroupRsvpPreferences = async (
  eventId: string,
  groupId: string
) => {
  try {
    const groupPreference = await prisma.eventGuestGroup.findUnique({
      where: {
        event_id_guest_group_id: {
          event_id: eventId,
          guest_group_id: groupId
        }
      },
      include: {
        guestGroup: {
          select: {
            id: true,
            name: true
          }
        },
        event: {
          select: {
            id: true,
            title: true,
            start_date_time: true,
            end_date_time: true
          }
        }
      }
    });

    if (!groupPreference) {
      return {
        success: false,
        error: 'Group not found or not associated with this event'
      };
    }

    return {
      success: true,
      preferences: {
        event: groupPreference.event,
        group: groupPreference.guestGroup,
        rsvp_lock_date: groupPreference.rsvp_lock_date,
        collect_food: groupPreference.collect_food,
        collect_alcohol: groupPreference.collect_alcohol,
        global_additional_details: groupPreference.global_additional_details,
        allow_additional_guests: groupPreference.allow_additional_guests,
        collect_accommodation: groupPreference.collect_accommodation,
        accommodation_details: groupPreference.accommodation_details,
        collect_transport: groupPreference.collect_transport,
        transport_details: groupPreference.transport_details
      }
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get group RSVP preferences'
    };
  }
};

export const getRsvpPreferencesForGroup = async (eventId: string, groupId: string) => {
  try {
    const eventGuestGroup = await prisma.eventGuestGroup.findUnique({
      where: {
        event_id_guest_group_id: {
          event_id: eventId,
          guest_group_id: groupId
        }
      },
      include: {
        guestGroup: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!eventGuestGroup) {
      return {
        success: false,
        error: 'Event-group association not found'
      };
    }

    // Check if RSVP is locked
    const isRsvpAllowed = !eventGuestGroup.rsvp_lock_date || 
                         new Date() <= eventGuestGroup.rsvp_lock_date;
    
    let daysUntilLock = null;
    if (eventGuestGroup.rsvp_lock_date && isRsvpAllowed) {
      const now = new Date();
      const lockDate = new Date(eventGuestGroup.rsvp_lock_date);
      const diffTime = lockDate.getTime() - now.getTime();
      daysUntilLock = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    const preferences = {
      collect_attendance: true, // Always collect attendance
      collect_guest_count: eventGuestGroup.allow_additional_guests || false,
      collect_food: eventGuestGroup.collect_food || false,
      collect_alcohol: eventGuestGroup.collect_alcohol || false,
      collect_accommodation: eventGuestGroup.collect_accommodation || false,
      accommodation_details: eventGuestGroup.accommodation_details,
      collect_transport: eventGuestGroup.collect_transport || false,
      transport_details: eventGuestGroup.transport_details,
      additional_notes: eventGuestGroup.global_additional_details,
      rsvp_lock_date: eventGuestGroup.rsvp_lock_date,
      isRsvpAllowed,
      daysUntilLock,
      group: eventGuestGroup.guestGroup
    };

    return {
      success: true,
      preferences
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get RSVP preferences'
    };
  }
};

export const updateRsvpPreferencesForGroup = async (
  eventId: string,
  groupId: string,
  data: {
    rsvp_lock_date?: Date;
    collect_food?: boolean;
    collect_alcohol?: boolean;
    global_additional_details?: string;
    allow_additional_guests?: boolean;
    collect_accommodation?: boolean;
    accommodation_details?: string;
    collect_transport?: boolean;
    transport_details?: string;
  }
) => {
  try {
    const updatedEventGuestGroup = await prisma.eventGuestGroup.update({
      where: {
        event_id_guest_group_id: {
          event_id: eventId,
          guest_group_id: groupId
        }
      },
      data: {
        ...(data.rsvp_lock_date !== undefined && { rsvp_lock_date: data.rsvp_lock_date }),
        ...(data.collect_food !== undefined && { collect_food: data.collect_food }),
        ...(data.collect_alcohol !== undefined && { collect_alcohol: data.collect_alcohol }),
        ...(data.global_additional_details !== undefined && { global_additional_details: data.global_additional_details }),
        ...(data.allow_additional_guests !== undefined && { allow_additional_guests: data.allow_additional_guests }),
        ...(data.collect_accommodation !== undefined && { collect_accommodation: data.collect_accommodation }),
        ...(data.accommodation_details !== undefined && { accommodation_details: data.accommodation_details }),
        ...(data.collect_transport !== undefined && { collect_transport: data.collect_transport }),
        ...(data.transport_details !== undefined && { transport_details: data.transport_details }),
        updated_at: new Date()
      },
      include: {
        guestGroup: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    return {
      success: true,
      preferences: updatedEventGuestGroup
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update RSVP preferences'
    };
  }
};