import makeWASocket, { DisconnectReason, useMultiFileAuthState, Browsers } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { EventEmitter } from 'events';
import pino from 'pino';

// Interface for our connection state
interface ConnectionState {
    status: 'DISCONNECTED' | 'PENDING_CODE' | 'CONNECTED' | 'ERROR';
    code?: string;
    message?: string;
}

// Setup a logger for detailed output
const logger = pino({ level: 'debug' });

class WhatsAppManager extends EventEmitter {
    private clients = new Map<string, any>();
    private connectionStates = new Map<string, ConnectionState>();

    constructor() {
        super();
    }

    private setState(userId: string, state: ConnectionState) {
        this.connectionStates.set(userId, state);
        this.emit(`update_${userId}`, state);
    }

    getState(userId: string): ConnectionState {
        return this.connectionStates.get(userId) || { status: 'DISCONNECTED' };
    }

    async startClient(userId: string, phoneNumber: string) {
        if (this.clients.has(userId)) {
            console.log(`Client for user ${userId} is already running.`);
            return;
        }

        this.setState(userId, { status: 'PENDING_CODE', message: 'Initiating connection...' });
        const { state, saveCreds } = await useMultiFileAuthState(`sessions/${userId}`);
        
        const sock = makeWASocket({
            auth: state,
            // Use a different browser agent and pass the logger
            browser: Browsers.windows('Chrome'),
            logger,
            printQRInTerminal: false
        });

        this.clients.set(userId, sock);
        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update: any) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'open') {
                this.setState(userId, { status: 'CONNECTED', message: 'WhatsApp is connected!' });
            } else if (connection === 'close') {
                const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                this.clients.delete(userId);
                this.setState(userId, { status: 'DISCONNECTED', message: `Connection closed: ${lastDisconnect?.error}` });
                
                if (shouldReconnect) {
                    console.log(`Reconnecting for user ${userId}...`);
                    this.startClient(userId, phoneNumber);
                }
            }
        });

        // Request the pairing code only if the user is not already registered
        if (!sock.authState.creds.registered) {
            // Give the connection a moment to stabilize before requesting the code
            setTimeout(async () => {
                try {
                    // Check if the socket is still trying to connect before proceeding
                    if (this.clients.has(userId)) {
                        const code = await sock.requestPairingCode(phoneNumber);
                        this.setState(userId, { status: 'PENDING_CODE', code: code, message: 'Please enter this code on your phone.' });
                    }
                } catch (error: any) {
                    console.error(`Failed to request pairing code for user ${userId}:`, error.message);
                    this.setState(userId, { status: 'ERROR', message: 'Could not generate pairing code. Please try again.' });
                    this.clients.delete(userId); // Clean up failed client
                }
            }, 3000); // Increased delay to 3 seconds
        }
    }

    async sendMessage(userId: string, jid: string, text: string) {
        const client = this.clients.get(userId);
        if (client && this.getState(userId).status === 'CONNECTED') {
            await client.sendMessage(jid, { text });
            return { success: true };
        } else {
            throw new Error('WhatsApp client for this user is not connected.');
        }
    }
}

export const whatsAppManager = new WhatsAppManager();