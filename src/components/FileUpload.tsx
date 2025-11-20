import { useRef } from 'react';
import type { ChangeEvent } from 'react';

interface FileUploadProps {
  onFilesSelected: (files: FileList | null, localPath?: string) => void;
  uploading: boolean;
}

export default function FileUpload({ onFilesSelected, uploading }: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    onFilesSelected(e.target.files);
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full p-8 bg-white rounded-lg shadow-md text-center">
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
      
      <div className="mb-6">
        <svg className="w-20 h-20 text-blue-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <h2 className="text-3xl font-bold mb-2 text-gray-900">Upload Invoices</h2>
        <p className="text-gray-600">Select PDF, JPG, or PNG files to process</p>
      </div>

      <button
        onClick={handleButtonClick}
        disabled={uploading}
        className="inline-flex items-center px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-lg hover:shadow-xl"
      >
        <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        {uploading ? 'Uploading...' : 'Select Files to Upload'}
      </button>

      <p className="text-sm text-gray-500 mt-4">
        Multiple files supported • Automatic AI processing
      </p>
    </div>
  );
}

