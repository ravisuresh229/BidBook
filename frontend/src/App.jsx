import { useState } from 'react';
import FileUpload from './components/FileUpload';
import ReviewTable from './components/ReviewTable';
import ITBScreen from './components/ITBScreen';

function App() {
  const [step, setStep] = useState('upload');
  const [proposals, setProposals] = useState([]);
  const [confirmedProposals, setConfirmedProposals] = useState([]);
  const [extractionMetadata, setExtractionMetadata] = useState({ mergeCount: 0, totalProcessed: 0 });
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleExtracted = (extractedProposals, metadata = {}) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setProposals(extractedProposals);
      setExtractionMetadata(metadata);
      setStep('review');
      setIsTransitioning(false);
    }, 300);
  };

  const handleConfirm = (editedProposals) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setConfirmedProposals(editedProposals);
      setStep('itb');
      setIsTransitioning(false);
    }, 300);
  };

  const handleBack = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setStep('upload');
      setIsTransitioning(false);
    }, 300);
  };

  const handleReset = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setProposals([]);
      setConfirmedProposals([]);
      setExtractionMetadata({ mergeCount: 0, totalProcessed: 0 });
      setStep('upload');
      setIsTransitioning(false);
    }, 300);
  };

  const handleStepClick = (index) => {
    if (index <= steps.findIndex(s => s.id === step)) {
      setIsTransitioning(true);
      setTimeout(() => {
        if (index === 0) setStep('upload');
        else if (index === 1 && proposals.length > 0) setStep('review');
        else if (index === 2 && confirmedProposals.length > 0) setStep('itb');
        setIsTransitioning(false);
      }, 300);
    }
  };

  const steps = [
    { id: 'upload', label: 'Upload' },
    { id: 'review', label: 'Review' },
    { id: 'itb', label: 'ITB' }
  ];

  const currentStepIndex = steps.findIndex(s => s.id === step);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/20 relative overflow-hidden">
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-2 h-2 bg-blue-200/30 rounded-full animate-float" style={{ animationDelay: '0s' }}></div>
        <div className="absolute top-40 right-20 w-1.5 h-1.5 bg-blue-300/30 rounded-full animate-float" style={{ animationDelay: '1s' }}></div>
        <div className="absolute bottom-32 left-1/4 w-2.5 h-2.5 bg-blue-200/20 rounded-full animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Frosted Glass Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-slate-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center gap-3">
            {/* Logo/Icon */}
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold text-slate-900">
              BidBook
            </h1>
          </div>
        </div>
      </header>

      {/* Animated Step Indicator - Only show after upload */}
      {step !== 'upload' && (
        <div className="sticky top-[73px] z-40 backdrop-blur-xl bg-white/80 border-b border-slate-200/50 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-center gap-2">
              {steps.map((stepItem, index) => (
                <div key={stepItem.id} className="flex items-center">
                  <button
                    onClick={() => handleStepClick(index)}
                    className={`px-6 py-2.5 rounded-lg font-semibold text-sm transition-all duration-300 ease-out ${
                      index === currentStepIndex
                        ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg scale-105'
                        : index < currentStepIndex
                        ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:scale-105 active:scale-95'
                        : 'bg-slate-50 text-slate-400 cursor-not-allowed'
                    }`}
                    disabled={index > currentStepIndex}
                  >
                    {stepItem.label}
                  </button>
                  {index < steps.length - 1 && (
                    <div
                      className={`w-8 h-0.5 mx-1 transition-all duration-300 ${
                        index < currentStepIndex
                          ? 'bg-gradient-to-r from-blue-600 to-blue-700'
                          : 'bg-slate-200'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Content with Transition */}
      <main className="py-8 relative z-10">
        <div className={`transition-all duration-300 ease-out ${isTransitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
          {step === 'upload' && (
            <FileUpload onExtracted={handleExtracted} />
          )}
          {step === 'review' && (
            <ReviewTable
              proposals={proposals}
              extractionMetadata={extractionMetadata}
              onConfirm={handleConfirm}
              onBack={handleBack}
            />
          )}
          {step === 'itb' && (
            <ITBScreen
              proposals={confirmedProposals}
              onReset={handleReset}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
