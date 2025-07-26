import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const createUser = async (data: {
  name: string;
  dob: string;
  mobile_number: string;
  email?: string;
  gender: 'M' | 'F' | 'Unspecified';
  profile_pic?: string;
}) => {
  const user = await prisma.user.create({
    data: {
      name: data.name,
      dob: new Date(data.dob),
      mobile_number: data.mobile_number,
      email: data.email,
      gender: data.gender,
      profile_pic: data.profile_pic ?? '',
    },
  });

  return user;
};
