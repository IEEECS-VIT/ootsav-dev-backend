import busboy from 'busboy';
import { uploadFile } from '../services/supabaseService';

/**
 * Parses a request with busboy and extracts form fields and files
 * @param req - Express request object
 * @returns Promise that resolves to an object containing fields and files
 */
export const parseMultipartForm = (req: any): Promise<{ fields: any; files: any[] }> => {
  return new Promise((resolve, reject) => {
    const bb = busboy({ headers: req.headers });
    const fields: any = {};
    const files: any[] = [];

    bb.on('file', (fieldname, file, info) => {
      const { filename, encoding, mimeType } = info;
      const fileData: any = {
        fieldname,
        filename,
        encoding,
        mimeType, 
        buffer: [] as Buffer[]
      };

      file.on('data', (data: Buffer) => {
        fileData.buffer.push(data);
      });

      file.on('end', () => {
        fileData.buffer = Buffer.concat(fileData.buffer);
        files.push(fileData);
      });

      file.on('error', (error) => {
        reject(error);
      });
    });

    bb.on('field', (fieldname, val) => {
      fields[fieldname] = val;
    });

    bb.on('close', () => {
      resolve({ fields, files });
    });

    bb.on('error', (error) => {
      reject(error);
    });

    req.pipe(bb);
  });
};

/**
 * Uploads files to Supabase storage and returns URLs
 * @param files - Array of file objects from parseMultipartForm
 * @param bucketName - Name of the Supabase storage bucket
 * @returns Promise that resolves to an array of URLs
 */
export const uploadFilesToSupabase = async (files: any[], bucketName: string): Promise<string[]> => {
  const urls: string[] = [];

  for (const file of files) {
    if (file.filename) {
      const uniqueFileName = `${Date.now()}-${file.filename}`;
      
      const uploadedUrl = await uploadFile(
        file.buffer, 
        uniqueFileName, 
        bucketName, 
        file.mimeType 
      );
      
      if (uploadedUrl) {
        urls.push(uploadedUrl);
      }
    }
  }

  return urls;
};

export default {
  parseMultipartForm,
  uploadFilesToSupabase
};