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