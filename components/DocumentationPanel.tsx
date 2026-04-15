import React from 'react';

interface DocumentationPanelProps {
  onClose: () => void;
}

const DocumentationPanel: React.FC<DocumentationPanelProps> = ({ onClose }) => {
  return (
    <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-md flex items-start justify-center p-6">
      <div className="w-full max-w-3xl rounded-3xl bg-slate-950/95 border border-slate-700 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900">
          <div>
            <h2 className="text-lg font-semibold text-white">Architecture & Cloud Documentation</h2>
            <p className="text-sm text-slate-400">Enterprise-grade platform design for AWS, Azure, streaming, ML, and BI.</p>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-white">Close</button>
        </div>

        <div className="p-6 space-y-6 text-slate-200 text-sm leading-6">
          <section>
            <h3 className="text-base font-semibold text-white">What is included</h3>
            <ul className="list-disc list-inside space-y-2">
              <li>Hybrid analytics architecture with AWS and Azure.</li>
              <li>Streaming ingestion using Kafka/MSK and Spark Structured Streaming.</li>
              <li>Batch ETL with EMR, Glue, and S3 lakehouse patterns.</li>
              <li>AI/ML pipelines using SageMaker, Bedrock, and AWS Data Wrangler.</li>
              <li>Enterprise documentation and deployment guidance.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-base font-semibold text-white">Where to review</h3>
            <p>
              Read the architecture design in <span className="font-semibold">docs/architecture.md</span> and deployment instructions in <span className="font-semibold">docs/deployment.md</span>.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-white">Key evaluation criteria</h3>
            <ol className="list-decimal list-inside space-y-2">
              <li>Clear separation of services and responsibilities.</li>
              <li>Cloud-native integration best practices.</li>
              <li>Data platform maturity and governance.</li>
              <li>AI/ML lifecycle and production readiness.</li>
              <li>Documentation that supports hiring review.</li>
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
};

export default DocumentationPanel;
