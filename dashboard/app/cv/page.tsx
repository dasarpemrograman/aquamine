"use client";

import { useState } from "react";
import ImageUploader from "../components/ImageUploader";
import LiveCameraView from "../components/LiveCameraView";

type Mode = "live" | "video" | "image";

export default function CVAnalysisPage() {
  const [mode, setMode] = useState<Mode>("live");

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
        <div className="mb-8">
          <div className="flex items-center justify-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-1 w-fit mx-auto">
            <button
              onClick={() => setMode("live")}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
                mode === "live"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              📷 Live Camera
            </button>
            <button
              onClick={() => setMode("video")}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
                mode === "video"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              🎥 Video File
            </button>
            <button
              onClick={() => setMode("image")}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
                mode === "image"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              🖼️ Image Upload
            </button>
          </div>
        </div>

        {mode === "live" && <LiveCameraView />}
        {mode === "video" && (
          <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-8 text-center">
            <p className="text-zinc-500 dark:text-zinc-400">
              Video File mode coming soon (Task 5)
            </p>
          </div>
        )}
        {mode === "image" && <ImageUploader />}
        
        <div className="mt-16 pt-8 border-t border-zinc-200 dark:border-zinc-800 text-center">
          <p className="text-xs text-zinc-400 uppercase tracking-widest">
            Powered by YOLOv8 • Inference Time &lt;100ms • Accuracy 94%
          </p>
        </div>
      </div>
    </div>
  );
}
