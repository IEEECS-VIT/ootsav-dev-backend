import { PrismaClient, EventType } from '@prisma/client';

const prisma = new PrismaClient();

export const createEvent = async (data: {
  title: string;
  type: EventType; 
  start_date_time: string; 
  end_date_time: string;   
  location?: string;
  address?: string;
  message?: string;
  image?: string;
  hostId: string;
}) => {
  try {
    const event = await prisma.event.create({
      data: {
        title: data.title,
        type: data.type,
        start_date_time: new Date(data.start_date_time),
        end_date_time: new Date(data.end_date_time),
        location: data.location || '',
        address: data.address || '',
        invite_message: data.message,
        image: data.image || '',
        host: {
          connect: { id: data.hostId }
        }
      }
    });

    return {
      success: true,
      event
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
        error: "Failed to create event",
      };
    }
  }
};

export const getEvent = async (eventId: string) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        host: true,
        co_hosts: true, 
      }
    });

    if (!event) {
      return null;
    }

    return event;
  } catch (error: unknown) {
    return null;
  }
};

export const addCohost = async (eventId: string, cohostId: string) => {
  try {
    const event = await prisma.event.update({
      where: { id: eventId },
      data: {
        co_hosts: {
          connect: { id: cohostId }
        }
      }
    });

    return {
      success: true,
      event
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
        error: "Failed to add cohost",
      };
    }
  }
};

export const removeCohost = async (eventId: string, cohostId: string) => {
  try {
    const event = await prisma.event.update({
      where: { id: eventId },
      data: {
        co_hosts: {
          disconnect: { id: cohostId }
        }
      }
    });

    return {
      success: true,
      event
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
        error: "Failed to remove cohost",
      };
    }
  }
};

// There is an issue with the date formatting
export const updateEvent = async (eventId: string, data: {
  title?: string;
  type?: EventType;
  start_date_time?: string;
  end_date_time?: string;
  location?: string;
  address?: string;
  message?: string;
}) => {
  try {
    const updateData: any = {};

    if (data.title) updateData.title = data.title;
    if (data.type) updateData.type = data.type;
    if (data.location) updateData.location = data.location;
    if (data.address) updateData.address = data.address;
    if (data.message) updateData.invite_message = data.message;
    
    if (data.start_date_time && data.end_date_time) {
      // Convert MM-DD-YYYY to YYYY-MM-DD format
      const [month, day, year] = data.start_date_time.split('-');
      const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      const dateTimeString = `${formattedDate}T${data.end_date_time}:00`;
      
      console.log("Original date:", data.start_date_time);
      console.log("Formatted date string:", dateTimeString);
      
      const date_time = new Date(dateTimeString);
      
      // Validate the date
      if (isNaN(date_time.getTime())) {
        return {
          success: false,
          error: "Invalid date or time provided"
        };
      }
      
      updateData.date_time = date_time;
    }

    const event = await prisma.event.update({
      where: { id: eventId },
      data: updateData
    });

    return {
      success: true,
      event
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
        error: "Failed to update event",
      };
    }
  }
};

export const addWeddingDetails = async (eventId: string, data: {
  bride_name: string;
  groom_name: string;
  bride_details?: string;
  groom_details?: string;
  bride_groom_images?: string[];
  hashtag?: string;
}) => {
  try {
    // First verify the event exists and is of type Wedding
    const event = await prisma.event.findUnique({
      where: { id: eventId }
    });

    if (!event) {
      return {
        success: false,
        error: "Event not found"
      };
    }

    if (event.type !== 'Wedding') {
      return {
        success: false,
        error: "Event is not a wedding type"
      };
    }

    const weddingDetails = await prisma.weddingEvent.create({
      data: {
        id: eventId,
        bride_name: data.bride_name,
        groom_name: data.groom_name,
        bride_details: data.bride_details || null,
        groom_details: data.groom_details || null,
        bride_groom_images: data.bride_groom_images || [],
        hashtag: data.hashtag || null
      }
    });

    return {
      success: true,
      weddingDetails
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
        error: "Failed to add wedding details",
      };
    }
  }
};

export const addBirthdayDetails = async (eventId: string, data: {
  person_image?: string;
  hashtag?: string;
}) => {
  try {
    // First verify the event exists and is of type Birthday
    const event = await prisma.event.findUnique({
      where: { id: eventId }
    });

    if (!event) {
      return {
        success: false,
        error: "Event not found"
      };
    }

    if (event.type !== 'Birthday') {
      return {
        success: false,
        error: "Event is not a birthday type"
      };
    }

    const birthdayDetails = await prisma.birthdayEvent.create({
      data: {
        id: eventId,
        person_image: data.person_image || null,
        hashtag: data.hashtag || null
      }
    });

    return {
      success: true,
      birthdayDetails
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
        error: "Failed to add birthday details",
      };
    }
  }
};

export const addHousePartyDetails = async (eventId: string, data: {
  cost?: number;
  rules?: string;
  terms?: string;
  tags?: string[];
}) => {
  try {
    // First verify the event exists and is of type Houseparty
    const event = await prisma.event.findUnique({
      where: { id: eventId }
    });

    if (!event) {
      return {
        success: false,
        error: "Event not found"
      };
    }

    if (event.type !== 'Houseparty') {
      return {
        success: false,
        error: "Event is not a houseparty type"
      };
    }

    const housePartyDetails = await prisma.housePartyEvent.create({
      data: {
        id: eventId,
        cost: data.cost || 0.0,
        rules: data.rules || null,
        terms: data.terms || null,
        tags: (data.tags || []) as any
      }
    });

    return {
      success: true,
      housePartyDetails
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
        error: "Failed to add house party details",
      };
    }
  }
};

export const addTravelDetails = async (eventId: string, data: {
  cost?: number;
  terms?: string;
  itinerary_included?: string[];
  itinerary_excluded?: string[];
  rules?: string;
  tags?: string[];
}) => {
  try {
    // First verify the event exists and is of type Travel
    const event = await prisma.event.findUnique({
      where: { id: eventId }
    });

    if (!event) {
      return {
        success: false,
        error: "Event not found"
      };
    }

    if (event.type !== 'Travel') {
      return {
        success: false,
        error: "Event is not a travel type"
      };
    }

    const travelDetails = await prisma.travelEvent.create({
      data: {
        id: eventId,
        cost: data.cost || 0.0,
        terms: data.terms || null,
        itinerary_included: data.itinerary_included || [],
        itinerary_excluded: data.itinerary_excluded || [],
        rules: data.rules || null,
        tags: (data.tags || []) as any
      }
    });

    return {
      success: true,
      travelDetails
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
        error: "Failed to add travel details",
      };
    }
  }
};

export const deleteEvent = async (eventId: string) => {
  try {
    const event = await prisma.event.delete({
      where: { id: eventId }
    });

    return {
      success: true,
      event
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
        error: "Failed to delete event",
      };
    }
  }
};