import { PrismaClient, Language, Gender } from '@prisma/client';

const prisma = new PrismaClient();

export const createUser = async (data: {
  name: string;
  dob: string;
  mobile_number: string;
  email?: string;
  gender: Gender;
  profile_pic?: string;
  preferred_language?: Language;
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
}) => {
  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.email && { email: data.email }),
        ...(data.dob && { dob: new Date(data.dob) }),
        ...(data.gender && { gender: data.gender }),
        ...(data.profile_pic && { profile_pic: data.profile_pic }),
        ...(data.preferred_language && { preferred_language: data.preferred_language as Language }),
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
