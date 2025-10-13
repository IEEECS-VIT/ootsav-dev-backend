import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';

let sock: any;
let isConnected = false;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    sock = makeWASocket({
        auth: state,
    });

    sock.ev.on('connection.update', (update: any) => {
        const { connection, lastDisconnect, qr } = update;

        if(qr) {
            console.log('QR code received, please scan:');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            isConnected = false;
            const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed. Reconnecting:', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            isConnected = true;
            console.log('WhatsApp client is ready!');
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

export const sendMessage = async (jid: string, text: string) => {
    // Wait up to 5 seconds for the connection to be established.
    if (!isConnected) {
        console.log('WhatsApp client not ready, waiting...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        if (!isConnected) {
            throw new Error('Could not connect to WhatsApp in time.');
        }
    }
    await sock.sendMessage(jid, { text });
};

connectToWhatsApp();