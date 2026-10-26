// whatsapp/whatsapp.service.js

// Import the Baileys library using CommonJS require syntax.
// `.default` ensures compatibility with the library's export structure.
const makeWASocket = require("baileys").default;

// Import the Node.js File System module using CommonJS syntax
const fs = require("fs");

// Import the Pino logging library for internal Baileys logging.
const P = require("pino");

// Destructure socket management utilities from the local local socket module.
const { getSocket, setSocket, removeSocket } = require("./whatsapp.socket.js");
// const { saveQr } = require("./whatsapp.auth.js");

/**
 * Service class handling WhatsApp connection life cycles and events.
 */
class WhatsAppService {
  /**
   * Initializes a new WhatsApp socket instance for a given session.
   * @param {string} sessionId - The unique identifier for the user session.
   * @param {Object} authState - The authentication credentials state for Baileys.
   * @returns {Promise<Object>} The initialized WhatsApp socket instance.
   */
  async create(sessionId, authState) {
    // Create the socket configuration with Baileys properties
    const sock = makeWASocket({
      // Pass authentication state to handle login session
      auth: authState,

      // Configure the logger to be silent to avoid terminal clutter
      logger: P({
        level: "silent",
      }),

      // Prevent the account from appearing online immediately upon connecting
      markOnlineOnConnect: false,

      // Ensure events triggered by this account are also emitted locally
      emitOwnEvents: true,

      // Enable rich, high-quality preview links for sent URLs
      generateHighQualityLinkPreview: true,

      // Disable full history syncing to reduce initial data load time
      syncFullHistory: false,
    });

    // Attach connection listeners to the newly created socket
    this.registerEvents(sessionId, sock);

    // Store the active socket reference globally using the session ID
    setSocket(sessionId, sock);

    return sock;
  }

  /**
   * Attaches event listeners to the WhatsApp socket to manage its status.
   * @param {string} sessionId - The unique identifier for the user session.
   * @param {Object} sock - The active WhatsApp socket instance.
   */
  registerEvents(sessionId, sock) {
    // Listen to core connection updates like QR generation or disconnections
    sock.ev.on("connection.update", async ({ connection, qr }) => {
      // Log the QR code to the console if it is generated
      if (qr) {
        console.log("QR:", qr);

        // QRCode.toString(qr, { type: "terminal" }, (err, url) => {
        //   console.log(url);
        // });
        // await saveQr(sessionId, qr);
      }

      // Handle connection closure cleanup and reconnection logic
      if (connection === "close") {
        // Clear the disconnected socket from global tracking memory
        removeSocket(sessionId);

        // Wait 5 seconds before attempting to reconnect to avoid spamming
        setTimeout(async () => {
          await this.reconnect(sessionId);
        }, 5000);
      }

      // Log confirmation once the connection is successfully established
      if (connection === "open") {
        console.log(`WhatsApp Connected: ${sessionId}`);
      }
    });
  }

  /**
   * Triggers the re-initialization process for a closed connection.
   * @param {string} sessionId - The unique identifier for the user session.
   */
  async reconnect(sessionId) {
    console.log(`Reconnecting ${sessionId}`);
  }

  /**
   * Sends a standard text message to a specified phone number.
   * @param {string} sessionId - The unique identifier for the user session.
   * @param {string} phone - The recipient's phone number (can include formatting).
   * @param {string} message - The text content to be sent.
   * @returns {Promise<Object>} The response payload from Baileys.
   * @throws {Error} If the socket connection for the session does not exist.
   */

  async sendText(sessionId, phone, message) {
    // Retrieve the active socket instance for this specific session
    const sock = getSocket(sessionId);

    // Guard clause: crash early if the session isn't initialized or active
    if (!sock) {
      throw new Error("WhatsApp not connected");
    }

    // Sanitize the phone number by removing all non-digit characters
    // and append the standard WhatsApp Jabber ID (JID) suffix
    const jid = phone.replace(/\D/g, "") + "@s.whatsapp.net";

    // Execute the message dispatch via Baileys and return the promise
    return await sock.sendMessage(jid, {
      text: message,
    });
  }

  /**
   * Sends a PDF document to a specified phone number using a file stream.
   * @param {string} sessionId - The unique identifier for the user session.
   * @param {string} phone - The recipient's phone number.
   * @param {string} filePath - The local server path where the PDF is stored.
   * @param {string} fileName - The display name the recipient will see for the file.
   * @returns {Promise<Object>} The response payload from Baileys.
   * @throws {Error} If the socket connection for the session does not exist.
   */
  async sendPDF(sessionId, phone, filePath, fileName) {
    // Retrieve the active socket instance for this specific session
    const sock = getSocket(sessionId);

    // Guard clause: error out if the session isn't initialized or active
    if (!sock) {
      throw new Error("WhatsApp not connected");
    }

    // Sanitize the phone number by stripping non-digits and adding the WhatsApp suffix
    const jid = phone.replace(/\D/g, "") + "@s.whatsapp.net";

    // Dispatch the document using a memory-efficient file read stream
    return await sock.sendMessage(jid, {
      // Read the file as a stream instead of loading the whole file into RAM
      document: fs.createReadStream(filePath),
      // Define the specific MIME type for PDF documents
      mimetype: "application/pdf",
      // Set the visible file name for the user interface
      fileName,
    });
  }

  async sendPDFUrl(sessionId, phone, pdfUrl, fileName) {
    const sock = getSocket(sessionId);

    const jid = phone.replace(/\D/g, "") + "@s.whatsapp.net";

    return await sock.sendMessage(jid, {
      document: {
        url: pdfUrl,
      },
      mimetype: "application/pdf",
      fileName,
    });
  }
}

// Instantiate the service to provide a single, shared instance across the app
const whatsappService = new WhatsAppService();

// Export both the class and the instantiated singleton service
module.exports = {
  WhatsAppService,
  whatsappService,
};
