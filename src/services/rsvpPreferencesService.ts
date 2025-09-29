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

    const groupPreferences = await prisma.eventGuestGroup.findMany({
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

    if (groupPreferences.length === 0) {
      return {
        success: false,
        error: 'No groups found for this event'
      };
    }

    return {
      success: true,
      groupPreferences,
      allPreferences: groupPreferences
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get event RSVP preferences'
    };
  }
};