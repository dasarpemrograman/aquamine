import ImageUploader from "../components/ImageUploader";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Visual Analysis | AquaMine",
  description: "AI-powered detection of Acid Mine Drainage indicators",
};

export default function CVAnalysisPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black selection:bg-blue-500/30">
      <div className="relative py-20 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-blue-100/40 via-transparent to-transparent dark:from-blue-900/10 dark:via-transparent dark:to-transparent" />
        
        <div className="relative max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-full border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-sm font-medium mb-4">
            <span className="relative flex h-2 w-2 mr-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            Computer Vision System v1.0
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Visual Analysis
          </h1>
          
          <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Upload site imagery to detect <span className="text-yellow-600 dark:text-yellow-500 font-semibold">Yellow Boy</span> precipitates. 
            Our model analyzes color signatures and texture patterns to assess contamination severity in real-time.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 pb-24">
        <ImageUploader />
        
        <div className="mt-16 pt-8 border-t border-zinc-200 dark:border-zinc-800 text-center">
          <p className="text-xs text-zinc-400 uppercase tracking-widest">
            Powered by YOLOv8 • Inference Time &lt;100ms • Accuracy 94%
          </p>
        </div>
      </div>
    </div>
  );
}
