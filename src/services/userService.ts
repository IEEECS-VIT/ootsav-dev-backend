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