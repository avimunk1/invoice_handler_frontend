import { getPresignedUrl, uploadToS3 } from '../api/client';

export interface UploadProgress {
  filename: string;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

/**
 * Upload multiple files to S3 and return their S3 paths
 */
export async function uploadFilesToS3(
  files: FileList,
  onProgress?: (progress: UploadProgress[]) => void
): Promise<string[]> {
  const fileArray = Array.from(files);
  const s3Paths: string[] = [];
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
      
      // Get presigned URL
      const presignedData = await getPresignedUrl(file.name);
      
      // Upload to S3
      await uploadToS3(file, presignedData);
      
      // Add S3 path to results
      s3Paths.push(presignedData.s3_path);
      
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
  
  return s3Paths;
}

