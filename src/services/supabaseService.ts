import { createClient } from '@supabase/supabase-js';
import { SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

/**
 * Uploads a file to Supabase storage
 * @param fileBuffer - The file buffer to upload
 * @param fileName - The name to give the file in storage
 * @param bucketName - The name of the bucket to upload to
 * @param contentType - The MIME type of the file
 * @returns The public URL of the uploaded file or null if upload failed
 */
export const uploadFile = async (
  fileBuffer: Buffer,
  fileName: string,
  bucketName: string,
  contentType?: string
): Promise<string | null> => {
  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(fileName, fileBuffer, {
        upsert: true, // Allow overwriting existing files
        contentType: contentType, // Specify the content type
      });

    if (error) {
      console.error('Error uploading file to Supabase:', error);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('Error uploading file:', error);
    return null;
  }
};

/**
 * Deletes a file from Supabase storage
 * @param fileName - The name of the file to delete
 * @param bucketName - The name of the bucket to delete from
 * @returns True if deletion was successful, false otherwise
 */
export const deleteFile = async (
  fileName: string,
  bucketName: string
): Promise<boolean> => {
  try {
    const { error } = await supabase.storage
      .from(bucketName)
      .remove([fileName]);

    if (error) {
      console.error('Error deleting file from Supabase:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
};

export default supabase;