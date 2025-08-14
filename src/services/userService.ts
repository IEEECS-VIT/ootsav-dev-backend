import { PrismaClient, Language, Gender, VerificationStatus } from '@prisma/client';

const prisma = new PrismaClient();

export const createUser = async (data: {
  name: string;
  dob: string;
  mobile_number: string;
  email?: string;
  gender: Gender;
  profile_pic?: string;
  preferred_language?: Language;
  verification_status?: VerificationStatus;
}) => {
  const user = await prisma.user.create({
    data: {
      name: data.name,
      dob: new Date(data.dob),
      mobile_number: data.mobile_number,
      ...(data.email && { email: data.email }),
      gender: data.gender,
      profile_pic: data.profile_pic ?? '',
      preferred_language: data.preferred_language as Language,
      verification_status: data.verification_status || 'unverified',
    },
  });

  return user;
};

export const getUser = async (userId: string) => {
  const user = await prisma.user.findUnique({where: {id: userId}})
  if (!user) {
    return null
  }
  return user
}

export const updateUser = async (userId: string, data: {
  name?: string;
  dob?: string;
  email?: string;
  gender?: Gender;
  profile_pic?: string;
  preferred_language?: Language;
  verification_status?: VerificationStatus;
}) => {
  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.email && { email: data.email }),
        ...(data.dob && { dob: new Date(data.dob) }),
        ...(data.gender && { gender: data.gender }),
        ...(data.profile_pic !== undefined && { profile_pic: data.profile_pic }),
        ...(data.preferred_language && { preferred_language: data.preferred_language as Language }),
        ...(data.verification_status && { verification_status: data.verification_status }),
      }
    });
    return {
      success: true,
      user: updatedUser
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      return {
        success: false,
        error: error?.message,
      };
    } else {
      return {
        success: false,
        error: "Failed to update user",
      };
    }
    
  }
}

export const getUserByPhoneNumber = async (phoneNumber: string) => {
  try {
    const user = await prisma.user.findUnique({
      where: { mobile_number: phoneNumber }
    });

    if (!user) {
      return null;
    }

    return user;
  } catch (error: unknown) {
    return null;
  }
};

// New function to verify a user (mark as verified)
export const verifyUser = async (userId: string) => {
  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        verification_status: 'verified'
      }
    });

    return {
      success: true,
      user
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
        error: "Failed to verify user",
      };
    }
  }
};

// Enhanced function to link unlinked RSVPs to a user account during onboarding/verification
export const linkUserRsvps = async (userId: string, phoneNumber: string) => {
  try {
    // Find all unlinked guest records with this phone number
    const unlinkedGuests = await prisma.guest.findMany({
      where: {
        user_id: null,
        phone_no: phoneNumber
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

    if (unlinkedGuests.length === 0) {
      return {
        success: true,
        linkedCount: 0,
        linkedRsvps: []
      };
    }

    // Get user details to replace the contact info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        mobile_number: true,
        email: true
      }
    });

    if (!user) {
      return {
        success: false,
        error: 'User not found'
      };
    }

    // Link all unlinked guests to the user account
    const updatedGuests = await Promise.all(
      unlinkedGuests.map(async (guest) => {
        // Check if user already has a guest record for this event
        const existingLinkedGuest = await prisma.guest.findFirst({
          where: {
            user_id: userId,
            event_id: guest.event_id
          }
        });

        if (existingLinkedGuest) {
          // If user already has a linked RSVP for this event, delete the unlinked one
          await prisma.guest.delete({
            where: { id: guest.id }
          });
          return null;
        } else {
          // Link the unlinked guest to the user account
          return await prisma.guest.update({
            where: { id: guest.id },
            data: {
              user_id: userId,
              // Clear the contact info since it's now linked to user
              name: null,
              phone_no: null,
              email: null
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
      })
    );

    // Filter out null values
    const linkedRsvps = updatedGuests.filter(guest => guest !== null);

    return {
      success: true,
      linkedCount: linkedRsvps.length,
      linkedRsvps,
      message: linkedRsvps.length > 0 
        ? `Successfully linked ${linkedRsvps.length} previous RSVP${linkedRsvps.length > 1 ? 's' : ''} to your account!`
        : 'No previous RSVPs found to link.'
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to link RSVPs'
    };
  }
};

// Get user's RSVP history including previously unlinked ones (now linked)
export const getUserRsvpHistory = async (userId: string) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { mobile_number: true }
    });

    if (!user) {
      return {
        success: false,
        error: 'User not found'
      };
    }

    // Get all RSVPs for this user (now all should be linked)
    const userRsvps = await prisma.guest.findMany({
      where: {
        user_id: userId,
        rsvp: { not: 'no_response' }
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
          start_date_time: 'desc'
        }
      }
    });

    // Separate upcoming and past events
    const now = new Date();
    const upcomingRsvps = userRsvps.filter(rsvp => rsvp.event.start_date_time > now);
    const pastRsvps = userRsvps.filter(rsvp => rsvp.event.start_date_time <= now);

    return {
      success: true,
      rsvps: userRsvps,
      upcomingRsvps,
      pastRsvps,
      totalRsvps: userRsvps.length,
      summary: {
        total: userRsvps.length,
        upcoming: upcomingRsvps.length,
        past: pastRsvps.length,
        accepted: userRsvps.filter(r => r.rsvp === 'accepted').length,
        declined: userRsvps.filter(r => r.rsvp === 'declined').length,
        maybe: userRsvps.filter(r => r.rsvp === 'maybe').length
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get RSVP history'
    };
  }
};

// Check for unlinked RSVPs by phone number (useful for onboarding flow)
export const checkUnlinkedRsvps = async (phoneNumber: string) => {
  try {
    const unlinkedGuests = await prisma.guest.findMany({
      where: {
        user_id: null,
        phone_no: phoneNumber,
        rsvp: { not: 'no_response' }
      },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            type: true,
            start_date_time: true
          }
        }
      }
    });

    return {
      success: true,
      hasUnlinkedRsvps: unlinkedGuests.length > 0,
      count: unlinkedGuests.length,
      unlinkedRsvps: unlinkedGuests
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check unlinked RSVPs'
    };
  }
};

// Function to create user during onboarding with automatic RSVP linking
export const createUserWithRsvpLinking = async (data: {
  name: string;
  dob: string;
  mobile_number: string;
  email?: string;
  gender: Gender;
  profile_pic?: string;
  preferred_language?: Language;
  verification_status?: VerificationStatus;
}) => {
  try {
    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Create the user
      const user = await tx.user.create({
        data: {
          name: data.name,
          dob: new Date(data.dob),
          mobile_number: data.mobile_number,
          ...(data.email && { email: data.email }),
          gender: data.gender,
          profile_pic: data.profile_pic ?? '',
          preferred_language: data.preferred_language as Language,
          verification_status: data.verification_status || 'verified', // Default to verified for onboarding
        },
      });

      // Check for unlinked RSVPs and link them
      const unlinkedGuests = await tx.guest.findMany({
        where: {
          user_id: null,
          phone_no: data.mobile_number
        },
        include: {
          event: {
            select: {
              id: true,
              title: true,
              start_date_time: true
            }
          }
        }
      });

      let linkedCount = 0;
      const linkedRsvps = [];

      for (const guest of unlinkedGuests) {
        // Check if user already has a linked RSVP for this event (shouldn't happen but safety check)
        const existingLinkedGuest = await tx.guest.findFirst({
          where: {
            user_id: user.id,
            event_id: guest.event_id
          }
        });

        if (!existingLinkedGuest) {
          // Link the unlinked guest to the user account
          const linkedGuest = await tx.guest.update({
            where: { id: guest.id },
            data: {
              user_id: user.id,
              // Clear the contact info since it's now linked to user
              name: null,
              phone_no: null,
              email: null
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
          linkedRsvps.push(linkedGuest);
          linkedCount++;
        } else {
          // Delete the duplicate unlinked record
          await tx.guest.delete({
            where: { id: guest.id }
          });
        }
      }

      return {
        user,
        linkedCount,
        linkedRsvps
      };
    });

    return {
      success: true,
      user: result.user,
      linkedRsvps: {
        count: result.linkedCount,
        rsvps: result.linkedRsvps,
        message: result.linkedCount > 0 
          ? `Welcome! We found and linked ${result.linkedCount} of your previous RSVP${result.linkedCount > 1 ? 's' : ''} to your account.`
          : null
      }
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
        error: "Failed to create user and link RSVPs",
      };
    }
  }
};