import { uploadFile } from '../api/client';

export interface UploadProgress {
  filename: string;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

/**
 * Upload multiple files to backend and return the upload directory path
 */
export async function uploadFilesToS3(
  files: FileList,
  onProgress?: (progress: UploadProgress[]) => void
): Promise<string> {
  const fileArray = Array.from(files);
  let uploadDir = '';
  const progress: UploadProgress[] = fileArray.map(f => ({
    filename: f.name,
    status: 'pending',
  }));
  
  onProgress?.(progress);
  
  for (let i = 0; i < fileArray.length; i++) {
    const file = fileArray[i];
    
    try {
      // Update progress
      progress[i].status = 'uploading';
      onProgress?.(progress);
      
      // Upload file directly to backend
      const uploadResponse = await uploadFile(file);
      
      if (!uploadResponse.success) {
        throw new Error('Upload failed');
      }
      
      // Store upload directory from first file
      if (i === 0) {
        uploadDir = uploadResponse.upload_dir;
      }
      
      // Update progress
      progress[i].status = 'completed';
      onProgress?.(progress);
      
    } catch (error) {
      progress[i].status = 'error';
      progress[i].error = error instanceof Error ? error.message : 'Upload failed';
      onProgress?.(progress);
      throw error;
    }
  }
  
  return uploadDir;
}

