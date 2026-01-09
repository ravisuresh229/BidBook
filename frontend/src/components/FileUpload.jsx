import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';

export default function FileUpload({ onExtracted }) {
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  const handleFileSelect = (selectedFiles) => {
    const pdfFiles = Array.from(selectedFiles).filter(file => 
      file.type === 'application/pdf'
    );
    setFiles(prev => [...prev, ...pdfFiles]);
    setError(null);
  };

  const handleInputChange = (e) => {
    if (e.target.files) {
      handleFileSelect(e.target.files);
      // Reset input value so same file can be selected again
      e.target.value = '';
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const truncateFileName = (name, maxLength = 30) => {
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength - 3) + '...';
  };

  const handleExtract = async () => {
    if (files.length === 0) {
      setError('Please select at least one PDF file');
      return;
    }

    setIsLoading(true);
    setError(null);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await axios.post(`${apiUrl}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (response.data && response.data.proposals) {
        setTimeout(() => {
          onExtracted(response.data.proposals, {
            mergeCount: response.data.merge_count || 0,
            totalProcessed: response.data.total_processed || response.data.proposals.length
          });
        }, 500);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to extract data from PDFs');
      setUploadProgress(0);
    } finally {
      setTimeout(() => {
        setIsLoading(false);
        setUploadProgress(0);
      }, 1000);
    }
  };

  return (
    <div className="relative w-full max-w-5xl mx-auto px-6 py-16">
      {/* Animated Background Gradient Blobs */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-400/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-300/10 rounded-full blur-3xl"></div>
      </div>

      {/* Subtle Grid Pattern Overlay */}
      <div 
        className="absolute inset-0 -z-10 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}
      ></div>

      {/* Hero Section with Gradient Text */}
      <motion.div 
        className="text-center mb-16"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight tracking-tight">
          <span className="bg-gradient-to-r from-slate-900 via-blue-800 to-slate-900 bg-clip-text text-transparent">
            Build your bid list in minutes
          </span>
        </h1>
        <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Drop your subcontractor proposals. We'll extract every contact, organize by trade, and prep your invitations.
        </p>
      </motion.div>

      {/* Glassmorphism Upload Zone */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="relative"
      >
        <div
          className={`relative backdrop-blur-md bg-white/70 border border-white/20 rounded-3xl shadow-xl shadow-blue-500/10 min-h-[360px] flex flex-col items-center justify-center text-center transition-all duration-300 ${
            isDragging
              ? 'border-blue-400/50 bg-blue-50/50 shadow-2xl shadow-blue-500/20 -translate-y-1 scale-[1.01]'
              : 'hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-500/20'
          } ${files.length > 0 ? '' : 'cursor-pointer'}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => files.length === 0 && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            multiple
            onChange={handleInputChange}
            className="hidden"
          />
          
          {/* Floating Decorative Elements */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
            <div className="absolute top-8 left-8 w-2 h-2 bg-blue-400/20 rounded-full animate-float" style={{ animationDelay: '0s' }}></div>
            <div className="absolute top-16 right-12 w-1.5 h-1.5 bg-indigo-400/20 rounded-full animate-float" style={{ animationDelay: '1.5s' }}></div>
            <div className="absolute bottom-12 left-1/4 w-2.5 h-2.5 bg-purple-400/20 rounded-full animate-float" style={{ animationDelay: '2.5s' }}></div>
            <div className="absolute bottom-20 right-1/3 w-2 h-2 bg-blue-400/20 rounded-full animate-float" style={{ animationDelay: '1s' }}></div>
            
            {/* Tiny PDF Icons */}
            <div className="absolute top-12 right-20 opacity-10">
              <svg className="w-6 h-6 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="absolute bottom-16 left-16 opacity-10">
              <svg className="w-5 h-5 text-indigo-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          
          {/* Upload Content */}
          {files.length === 0 && (
            <div className="space-y-6 px-8 relative z-10 py-12">
              {/* Upload Icon with gentle breathe animation */}
              <motion.div 
                className="animate-float"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="mx-auto w-28 h-28 bg-gradient-to-br from-blue-100/80 to-indigo-100/80 rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm">
                  <svg
                    className={`h-14 w-14 transition-colors duration-300 ${
                      isDragging ? 'text-blue-600' : 'text-blue-500'
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                </div>
              </motion.div>
              
              {/* Text */}
              <div>
                <p className="text-lg font-medium">
                  <span className="text-blue-600 font-semibold hover:underline cursor-pointer transition-all duration-200">
                    Click to upload
                  </span>
                  <span className="text-slate-600"> or drag and drop</span>
                </p>
                <p className="text-sm text-slate-500 mt-3">Drop your PDF proposals here</p>
              </div>
            </div>
          )}

          {/* Selected Files Display */}
          {files.length > 0 && (
            <div className="w-full px-8 py-6 space-y-4">
              <div className="text-center mb-4 space-y-2">
                <p className="text-sm font-semibold text-slate-700">
                  {files.length} file{files.length !== 1 ? 's' : ''} selected
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium hover:underline transition-colors"
                  type="button"
                >
                  + Add More Files
                </button>
              </div>
              
              <div className="flex flex-wrap gap-2 justify-center max-h-32 overflow-y-auto">
                {files.map((file, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className="group inline-flex items-center gap-2 px-3 py-2 bg-white/80 backdrop-blur-sm border border-slate-200/50 rounded-lg shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200 hover:scale-105"
                  >
                    <svg
                      className="h-4 w-4 text-red-500 flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-xs font-medium text-slate-700 truncate max-w-[120px]">
                      {truncateFileName(file.name, 20)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(index);
                      }}
                      className="ml-1 text-slate-400 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all duration-200 p-0.5 rounded"
                      type="button"
                    >
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Primary Action Button - Inside Upload Zone, Animated In */}
          <AnimatePresence>
            {files.length > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="w-full px-8 pb-6"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={handleExtract}
                  disabled={isLoading}
                  className={`w-full py-4 px-6 rounded-xl font-semibold transition-all duration-300 ease-out relative overflow-hidden ${
                    isLoading
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl hover:scale-[1.02] active:scale-95 shadow-lg shadow-blue-500/20'
                  }`}
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-3">
                      <svg
                        className="animate-spin h-5 w-5"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      <span>Processing {files.length} file{files.length !== 1 ? 's' : ''}...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <span>Process {files.length} file{files.length !== 1 ? 's' : ''}</span>
                      <svg
                        className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 7l5 5m0 0l-5 5m5-5H6"
                        />
                      </svg>
                    </div>
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Progress Bar - Inside Upload Zone */}
          {isLoading && uploadProgress > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-full px-8 pb-6 space-y-2"
            >
              <div className="w-full bg-slate-200/50 rounded-full h-2 overflow-hidden backdrop-blur-sm">
                <motion.div
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 h-2 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress}%` }}
                  transition={{ duration: 0.3 }}
                ></motion.div>
              </div>
              <p className="text-xs text-slate-600 text-center">
                {uploadProgress}% complete
              </p>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Trust Indicators - Premium Pills */}
      <motion.div 
        className="flex justify-center gap-4 mt-10 mb-16 flex-wrap"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <div className="group flex items-center gap-2 px-4 py-2.5 bg-white/60 backdrop-blur-sm border border-slate-200/50 rounded-full shadow-sm hover:shadow-md hover:border-blue-200 hover:bg-white/80 transition-all duration-200 cursor-default">
          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <span className="text-sm font-medium text-slate-700">No manual data entry</span>
        </div>
        <div className="group flex items-center gap-2 px-4 py-2.5 bg-white/60 backdrop-blur-sm border border-slate-200/50 rounded-full shadow-sm hover:shadow-md hover:border-blue-200 hover:bg-white/80 transition-all duration-200 cursor-default">
          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-sm font-medium text-slate-700">Even blurry scans work</span>
        </div>
        <div className="group flex items-center gap-2 px-4 py-2.5 bg-white/60 backdrop-blur-sm border border-slate-200/50 rounded-full shadow-sm hover:shadow-md hover:border-blue-200 hover:bg-white/80 transition-all duration-200 cursor-default">
          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium text-slate-700">Know what needs review</span>
        </div>
      </motion.div>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-6 p-4 bg-red-50/80 backdrop-blur-sm border border-red-200/50 rounded-xl mb-12"
          >
            <p className="text-sm text-red-800 font-medium">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* How It Works Section */}
      <motion.div 
        className="mt-20 pt-12 border-t border-slate-200/50"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
      >
        <h2 className="text-2xl font-bold text-slate-900 text-center mb-12">
          How it works
        </h2>
        <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-8 max-w-4xl mx-auto">
          {/* Step 1 */}
          <motion.div 
            className="text-center flex-1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Upload</h3>
            <p className="text-sm text-slate-600">
              Drop your PDF proposals
            </p>
          </motion.div>

          {/* Arrow */}
          <div className="hidden md:flex items-center justify-center">
            <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </div>

          {/* Step 2 */}
          <motion.div 
            className="text-center flex-1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Review</h3>
            <p className="text-sm text-slate-600">
              See extracted contacts by trade
            </p>
          </motion.div>

          {/* Arrow */}
          <div className="hidden md:flex items-center justify-center">
            <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </div>

          {/* Step 3 */}
          <motion.div 
            className="text-center flex-1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Invite</h3>
            <p className="text-sm text-slate-600">
              Send ITB to your bid list
            </p>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
