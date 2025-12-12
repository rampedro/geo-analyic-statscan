import React from 'react';

interface AnalysisPanelProps {
  isLoading: boolean;
  content: string;
  onAnalyze: () => void;
  canAnalyze: boolean;
  city: string;
}

const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ 
  isLoading, 
  content, 
  onAnalyze, 
  canAnalyze,
  city 
}) => {
  return (
    <div className="bg-gray-800/90 backdrop-blur-md border-t border-gray-700 p-4 absolute bottom-0 left-0 w-full sm:w-96 sm:relative sm:border-t-0 sm:border-l sm:h-full flex flex-col z-20">
      <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <span className="text-secondary">✦</span> Gemini AI Insights
      </h2>
      
      <div className="flex-grow overflow-y-auto mb-4 bg-gray-900/50 rounded-lg p-4 border border-gray-700">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
            <span className="text-sm">Analyzing regional data...</span>
          </div>
        ) : content ? (
          <p className="text-gray-200 leading-relaxed text-sm">{content}</p>
        ) : (
          <p className="text-gray-500 italic text-sm text-center mt-10">
            Select a metric and a region, then click Analyze to generate insights.
          </p>
        )}
      </div>

      <div className="mt-auto">
        <div className="text-xs text-gray-500 mb-2 font-mono">
           TARGET: {city || "ALL REGIONS"}
        </div>
        <button
          onClick={onAnalyze}
          disabled={!canAnalyze || isLoading}
          className={`w-full py-3 px-4 rounded-lg font-semibold tracking-wide transition-all duration-200
            ${!canAnalyze 
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
              : 'bg-gradient-to-r from-primary to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/20'
            }
          `}
        >
          {isLoading ? 'Processing...' : 'Generate Report'}
        </button>
      </div>
    </div>
  );
};

export default AnalysisPanel;