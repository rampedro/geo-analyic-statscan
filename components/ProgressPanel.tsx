import React from 'react';
import { LoadingTask } from '../types';

interface ProgressPanelProps {
  tasks: LoadingTask[];
}

const ProgressPanel: React.FC<ProgressPanelProps> = ({ tasks }) => {
  if (tasks.length === 0) return null;

  return (
    <div className="absolute bottom-6 right-6 z-50 flex flex-col gap-2 w-72 pointer-events-none">
      {tasks.map((task) => (
        <div 
          key={task.id} 
          className="bg-gray-900/90 backdrop-blur border-l-4 border-primary shadow-xl p-3 rounded-r-lg animate-in slide-in-from-right-10 fade-in duration-300 flex items-center justify-between"
        >
          <div className="flex flex-col w-full">
            <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-gray-200">{task.message}</span>
                {task.type === 'info' && <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>}
            </div>
            
            {task.progress !== undefined && (
                <div className="w-full bg-gray-700 h-1 rounded-full overflow-hidden mt-1">
                    <div 
                        className="bg-primary h-full transition-all duration-300 ease-out" 
                        style={{ width: `${task.progress}%` }}
                    ></div>
                </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ProgressPanel;