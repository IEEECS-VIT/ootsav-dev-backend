import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
const twilioWhatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER;

if (!accountSid || !authToken || !verifyServiceSid || !twilioWhatsappNumber) {
  throw new Error('Twilio environment variables are required: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID, TWILIO_WHATSAPP_NUMBER');
}

const client = twilio(accountSid, authToken);

export const sendOTP = async (phone: string) => {
  const verification = await client.verify.v2
    .services(verifyServiceSid)
    .verifications.create({ to: phone, channel: 'sms' });

  return verification.status;
};

export const verifyOTP = async (phone: string, code: string) => {
  const verificationCheck = await client.verify.v2
    .services(verifyServiceSid)
    .verificationChecks.create({ to: phone, code });

  return verificationCheck.status === 'approved';
};

export const sendWhatsappMessage = async (to: string, body: string) => {
  try {
    console.log('[twilioService.sendWhatsappMessage] Sending message to:', to);
    const message = await client.messages.create({
      from: `whatsapp:${twilioWhatsappNumber}`,
      to: `whatsapp:${to}`,
      body: body,
    });
    console.log('[twilioService.sendWhatsappMessage] Message sent successfully, SID:', message.sid);
    return { success: true, sid: message.sid };
  } catch (error) {
    console.error('[twilioService.sendWhatsappMessage] Error sending WhatsApp message via Twilio:', error);
    return { success: false, error };
  }
};
