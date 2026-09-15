// utils/uploadFiles.js

const fs = require("fs");
const fsPromises = require("fs/promises");
const path = require("path");
const mime = require("mime-types");
const { storage } = require("../firebase");

//
// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------

/**
 * Validate file existence
 */
async function validateFile(filePath) {
  try {
    await fsPromises.access(filePath, fs.constants.F_OK);
  } catch (error) {
    throw new Error(`File does not exist: ${filePath}`);
  }
}

/**
 * Upload file to Firebase Storage
 */
async function uploadToFirebase({
  localFilePath,
  destination,
  makePublic = true,
  metadata = {},
}) {
  try {
    await validateFile(localFilePath);

    const contentType =
      mime.lookup(localFilePath) || "application/octet-stream";

    const uploadResponse = await storage.upload(localFilePath, {
      destination,

      resumable: false,

      metadata: {
        contentType,
        cacheControl: "public, max-age=31536000",

        metadata: {
          uploadedAt: new Date().toISOString(),
          ...metadata,
        },
      },
    });

    const uploadedFile = uploadResponse[0];

    //
    // OPTIONAL: MAKE FILE PUBLIC
    //
    if (makePublic) {
      await uploadedFile.makePublic();

      return `https://storage.googleapis.com/${storage.name}/${destination}`;
      // return {
      //   success: true,
      //   url: `https://storage.googleapis.com/${storage.name}/${destination}`,
      //   path: destination,
      // };
    }

    //
    // SIGNED URL
    //
    const [signedUrl] = await uploadedFile.getSignedUrl({
      action: "read",
      expires: "03-01-2500",
    });
    return signedUrl;

    // return {
    //   success: true,
    //   url: signedUrl,
    //   path: destination,
    // };
  } catch (error) {
    console.error("Firebase Upload Error:", {
      message: error.message,
      stack: error.stack,
      destination,
    });

    throw new Error("File upload failed");
  } finally {
    //
    // ALWAYS CLEAN TEMP FILE
    //
    try {
      if (fs.existsSync(localFilePath)) {
        await fsPromises.unlink(localFilePath);

        // console.log("Temporary file deleted:", localFilePath);
      }
    } catch (cleanupError) {
      console.error("Cleanup Error:", cleanupError.message);
    }
  }
}

/**
 * Generic uploader
 */
async function uploadFile({
  fileName,
  localDirectory,
  storageDirectory,
  makePublic = true,
  metadata = {},
}) {
  if (!fileName) {
    throw new Error("fileName is required");
  }

  const sanitizedFileName = path.basename(fileName);

  const localFilePath = path.join(
    process.cwd(),
    localDirectory,
    sanitizedFileName,
  );

  const destination = path.posix.join(storageDirectory, sanitizedFileName);

  return uploadToFirebase({
    localFilePath,
    destination,
    makePublic,
    metadata,
  });
}

//
// -----------------------------------------------------------------------------
// VOUCHERS
// -----------------------------------------------------------------------------

async function uploadVoucherFile(fileName) {
  return uploadFile({
    fileName,
    localDirectory: "vouchers",
    storageDirectory: "gpcpins/vouchers",
    metadata: {
      type: "voucher",
    },
  });
}

//
// -----------------------------------------------------------------------------
// RECEIPTS
// -----------------------------------------------------------------------------

async function uploadReceiptFile(fileName) {
  return uploadFile({
    fileName,
    localDirectory: "receipts",
    storageDirectory: "gpcpins/receipts",
    metadata: {
      type: "receipt",
    },
  });
}

//
// -----------------------------------------------------------------------------
// PHOTOS
// -----------------------------------------------------------------------------

async function uploadPhoto(file) {
  if (!file?.filename) {
    throw new Error("Invalid photo file");
  }

  return uploadFile({
    fileName: file.filename,
    localDirectory: "images",
    storageDirectory: "gpcpins/photos",
    metadata: {
      type: "photo",
    },
  });
}

//
// -----------------------------------------------------------------------------
// ATTACHMENTS
// -----------------------------------------------------------------------------

async function uploadAttachment(file) {
  if (!file?.filename) {
    throw new Error("Invalid attachment file");
  }

  return uploadFile({
    fileName: file.filename,
    localDirectory: "images/attachments",
    storageDirectory: "gpcpins/attachments",
    metadata: {
      type: "attachment",
    },
  });
}

//
// -----------------------------------------------------------------------------
// CUSTOM FILES
// -----------------------------------------------------------------------------

async function uploadFiles(filename, location) {
  if (!filename || !location) {
    throw new Error("filename and location are required");
  }

  return uploadFile({
    fileName: filename,
    localDirectory: location,
    storageDirectory: location,
  });
}

//
// -----------------------------------------------------------------------------
// DELETE FILE
// -----------------------------------------------------------------------------

async function deleteFile(storagePath) {
  try {
    await storage.file(storagePath).delete();

    return {
      success: true,
      message: "File deleted successfully",
    };
  } catch (error) {
    console.error("Delete File Error:", error);

    throw new Error("Failed to delete file");
  }
}

async function deleteServerFile(filePath) {
  try {
    await fsPromises.unlink(filePath);
   
    return true;
  } catch (error) {
    // Prevent crashing if the file is already gone
    if (error.code === "ENOENT") {
      console.warn(`File not found, nothing to delete: ${filePath}`);
      return false;
    }

    // Handle permissions or other system errors
    console.error(`Error deleting file at ${filePath}:`, error.message);
    throw error;
  }
}

function getFileStream(path, transactionId) {
  const bucketFilePath = `gpcpins/${path}/${transactionId}.pdf`;
  const fileStream = storage.file(bucketFilePath).createReadStream();

  fileStream.on("error", (err) => {
    console.error(
      `Firebase stream error for transaction ${transactionId}:`,
      err,
    );
  });

  return fileStream;
}

async function getReceiptBuffer(url) {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer(); // NOT response.text()
  return Buffer.from(arrayBuffer);
}

//
// -----------------------------------------------------------------------------
// EXPORTS
// -----------------------------------------------------------------------------

module.exports = {
  uploadVoucherFile,
  uploadReceiptFile,
  uploadPhoto,
  uploadAttachment,
  uploadFiles,
  deleteFile,
  deleteServerFile,
  getFileStream,
  getReceiptBuffer
};
