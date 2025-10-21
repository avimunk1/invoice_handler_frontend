import { useState, useRef } from 'react';
import type { ChangeEvent } from 'react';
import type { UploadProgress } from '../services/s3Upload';

interface FileUploadProps {
  onFilesSelected: (files: FileList | null, localPath?: string) => void;
  uploading: boolean;
  uploadProgress?: UploadProgress[];
}

export default function FileUpload({ onFilesSelected, uploading, uploadProgress }: FileUploadProps) {
  const [mode, setMode] = useState<'s3' | 'local'>('s3');
  const [localPath, setLocalPath] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    onFilesSelected(e.target.files);
  };

  const handleLocalSubmit = () => {
    if (localPath.trim()) {
      onFilesSelected(null, localPath);
    }
  };

  return (
    <div className="w-full p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Upload Invoices</h2>
      
      {/* Mode Toggle */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setMode('s3')}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            mode === 's3'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Upload Files (S3)
        </button>
        <button
          onClick={() => setMode('local')}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            mode === 'local'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Local Folder
        </button>
      </div>

      {/* S3 Mode: File Upload */}
      {mode === 's3' && (
        <div className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileChange}
              disabled={uploading}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center"
            >
              <svg className="w-12 h-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span className="text-lg text-gray-600">
                {uploading ? 'Uploading...' : 'Click to select files or drag and drop'}
              </span>
              <span className="text-sm text-gray-500 mt-2">PDF, JPG, PNG files</span>
            </label>
          </div>

          {/* Upload Progress */}
          {uploadProgress && uploadProgress.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-700">Upload Progress:</h3>
              {uploadProgress.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                  <span className="flex-1 text-sm truncate">{item.filename}</span>
                  {item.status === 'pending' && (
                    <span className="text-gray-500 text-sm">Pending...</span>
                  )}
                  {item.status === 'uploading' && (
                    <span className="text-blue-600 text-sm">Uploading...</span>
                  )}
                  {item.status === 'completed' && (
                    <span className="text-green-600 text-sm">✓ Completed</span>
                  )}
                  {item.status === 'error' && (
                    <span className="text-red-600 text-sm">✗ {item.error}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Local Mode: Path Input */}
      {mode === 'local' && (
        <div className="space-y-4">
          <div>
            <label htmlFor="local-path" className="block text-sm font-medium text-gray-700 mb-2">
              Enter folder path:
            </label>
            <input
              id="local-path"
              type="text"
              value={localPath}
              onChange={(e) => setLocalPath(e.target.value)}
              placeholder="/Users/username/Documents/invoices"
              disabled={uploading}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={handleLocalSubmit}
            disabled={!localPath.trim() || uploading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? 'Processing...' : 'Process Folder'}
          </button>
        </div>
      )}
    </div>
  );
}

