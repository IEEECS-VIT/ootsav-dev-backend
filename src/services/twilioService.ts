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
  // Hardcoded test account for App Store verification
  const TEST_PHONE = '+917387424149';
  
  // Skip sending OTP for test account
  if (phone === TEST_PHONE) {
    console.log('[twilioService.sendOTP] Test account - skipping OTP send:', phone);
    return 'pending'; // Return same status as Twilio would
  }
  
  // Normal Twilio OTP sending for other users
  const verification = await client.verify.v2
    .services(verifyServiceSid)
    .verifications.create({ to: phone, channel: 'sms' });

  return verification.status;
};

export const verifyOTP = async (phone: string, code: string) => {
  // Hardcoded test account for App Store verification
  const TEST_PHONE = '+917387424149';
  const TEST_OTP = '100100';
  
  // Check if this is the test account
  if (phone === TEST_PHONE && code === TEST_OTP) {
    console.log('[twilioService.verifyOTP] Test account verified:', phone);
    return true;
  }
  
  // Normal Twilio verification for other users
  const verificationCheck = await client.verify.v2
    .services(verifyServiceSid)
    .verificationChecks.create({ to: phone, code });

  return verificationCheck.status === 'approved';
};

export const sendWhatsappMessage = async (to: string, body: string, mediaUrl?: string) => {
  try {
    console.log('[twilioService.sendWhatsappMessage] Sending message to:', to);

    const messageData: any = {
      from: `whatsapp:${twilioWhatsappNumber}`,
      to: `whatsapp:${to}`,
      body: body,
    };

    if (mediaUrl) {
      messageData.mediaUrl = [mediaUrl];
    }

    const message = await client.messages.create(messageData);
    console.log('[twilioService.sendWhatsappMessage] Message sent successfully, SID:', message.sid);
    return { success: true, sid: message.sid };
  } catch (error) {
    console.error('[twilioService.sendWhatsappMessage] Error sending WhatsApp message via Twilio:', error);
    return { success: false, error };
  }
};

export const sendWhatsappTemplateMessage = async (
  to: string,
  contentSid: string,
  contentVariables: { [key: string]: string }
) => {
  try {
    console.log('[twilioService.sendWhatsappTemplateMessage] Sending template message to:', to);
    console.log('[twilioService.sendWhatsappTemplateMessage] ContentSid:', contentSid);
    console.log('[twilioService.sendWhatsappTemplateMessage] Variables:', contentVariables);

    const message = await client.messages.create({
      from: `whatsapp:${twilioWhatsappNumber}`,
      to: `whatsapp:${to}`,
      contentSid: contentSid,
      contentVariables: JSON.stringify(contentVariables),
    });

    console.log('[twilioService.sendWhatsappTemplateMessage] Template message sent successfully, SID:', message.sid);
    return { success: true, sid: message.sid };
  } catch (error) {
    console.error('[twilioService.sendWhatsappTemplateMessage] Error sending WhatsApp template message via Twilio:', error);
    return { success: false, error };
  }
};

export const sendWhatsappTemplateMessageWithMedia = async (
  to: string,
  contentSid: string,
  bodyVariables: string[],
  headerMediaUrl?: string
) => {
  try {
    console.log('[twilioService.sendWhatsappTemplateMessageWithMedia] Sending template message with media to:', to);
    console.log('[twilioService.sendWhatsappTemplateMessageWithMedia] ContentSid:', contentSid);
    console.log('[twilioService.sendWhatsappTemplateMessageWithMedia] Body Variables:', bodyVariables);
    console.log('[twilioService.sendWhatsappTemplateMessageWithMedia] Header Media URL:', headerMediaUrl);

    // Build content variables in the correct format for Twilio Content API
    const contentVariables: any = {};
    
    // Add body variables (indexed from 1)
    bodyVariables.forEach((value, index) => {
      contentVariables[`${index + 1}`] = value;
    });

    console.log('[twilioService.sendWhatsappTemplateMessageWithMedia] Formatted Variables:', JSON.stringify(contentVariables));

    const messageOptions: any = {
      from: `whatsapp:${twilioWhatsappNumber}`,
      to: `whatsapp:${to}`,
      contentSid: contentSid,
      contentVariables: JSON.stringify(contentVariables),
    };

    // Add media URL separately if provided
    if (headerMediaUrl) {
      messageOptions.mediaUrl = [headerMediaUrl];
    }

    const message = await client.messages.create(messageOptions);

    console.log('[twilioService.sendWhatsappTemplateMessageWithMedia] Template message sent successfully, SID:', message.sid);
    return { success: true, sid: message.sid };
  } catch (error) {
    console.error('[twilioService.sendWhatsappTemplateMessageWithMedia] Error sending WhatsApp template message via Twilio:', error);
    return { success: false, error };
  }
};
