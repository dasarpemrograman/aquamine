"use client";

import { useState, useRef, ChangeEvent, DragEvent } from "react";
import { analyzeImage, AnalysisResponse } from "@/lib/api";

export default function ImageUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  
  const imgRef = useRef<HTMLImageElement>(null);
  const [renderedSize, setRenderedSize] = useState({ width: 0, height: 0 });

  const handleFile = (selectedFile: File) => {
    setResult(null);
    setError(null);
    setFile(selectedFile);
    
    const objectUrl = URL.createObjectURL(selectedFile);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return objectUrl;
    });
  };

  const handleDrag = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const analyze = async (imageFile: File) => {
    setLoading(true);
    try {
      const data = await analyzeImage(imageFile);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze image");
    } finally {
      setLoading(false);
    }
  };

  const handleImageLoad = () => {
    if (imgRef.current) {
      setRenderedSize({
        width: imgRef.current.clientWidth,
        height: imgRef.current.clientHeight,
      });
    }
  };

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case "none": return {
        bg: "bg-emerald-500",
        text: "text-emerald-500",
        border: "border-emerald-500",
        badge: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
      };
      case "mild": return {
        bg: "bg-yellow-500",
        text: "text-yellow-500",
        border: "border-yellow-500",
        badge: "bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800"
      };
      case "moderate": return {
        bg: "bg-orange-500",
        text: "text-orange-500",
        border: "border-orange-500",
        badge: "bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800"
      };
      case "severe": return {
        bg: "bg-rose-500",
        text: "text-rose-500",
        border: "border-rose-500",
        badge: "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800"
      };
      default: return {
        bg: "bg-zinc-500",
        text: "text-zinc-500",
        border: "border-zinc-500",
        badge: "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700"
      };
    }
  };

  const styles = result ? getSeverityStyles(result.severity) : getSeverityStyles("default");

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8">
      <div 
        className={`
          group relative overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300 ease-out
          ${dragActive 
            ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/10 scale-[1.01]" 
            : "border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600 bg-white dark:bg-zinc-900/50"
          }
          ${preview ? "h-auto" : "h-64"}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {!preview && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className={`
              p-4 rounded-full bg-zinc-100 dark:bg-zinc-800 mb-4 transition-transform duration-300
              ${dragActive ? "scale-110" : "group-hover:scale-105"}
            `}>
              <svg className="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
              Drop image for analysis
            </p>
            <p className="text-sm text-zinc-500 mt-2">
              or click to browse
            </p>
          </div>
        )}

        <input 
          type="file" 
          id="image-upload" 
          className={`absolute inset-0 w-full h-full opacity-0 cursor-pointer ${preview ? "hidden" : "block"}`}
          onChange={handleChange}
          accept="image/png, image/jpeg, image/jpg"
          disabled={loading}
        />

        {/* Preview Area */}
        {preview && (
          <div className="relative w-full">
            <img 
              ref={imgRef}
              src={preview} 
              alt="Analysis target" 
              className="w-full h-auto block"
              onLoad={handleImageLoad}
            />
            
            {preview && !loading && !result && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px] transition-all hover:bg-black/30">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (file) analyze(file);
                  }}
                  className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-full shadow-lg transform transition-all hover:scale-105 active:scale-95 flex items-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                  <span>Run Analysis</span>
                </button>
              </div>
            )}

            {loading && (
              <div className="absolute inset-0 bg-blue-500/10 overflow-hidden">
                <div className="absolute inset-x-0 h-0.5 bg-blue-400 shadow-[0_0_15px_rgba(96,165,250,0.8)] animate-[scan_2s_ease-in-out_infinite]" />
              </div>
            )}

            {result && !loading && renderedSize.width > 0 && result.bboxes.map((bbox, i) => {
              const scaleX = renderedSize.width / result.image_width;
              const scaleY = renderedSize.height / result.image_height;
              
              return (
                <div 
                  key={i}
                  className={`absolute border-2 ${styles.border} transition-opacity duration-500`}
                  style={{
                    left: `${bbox.x * scaleX}px`,
                    top: `${bbox.y * scaleY}px`,
                    width: `${bbox.width * scaleX}px`,
                    height: `${bbox.height * scaleY}px`,
                    boxShadow: '0 0 20px rgba(0,0,0,0.1)'
                  }}
                >
                  <div className={`absolute -top-7 left-0 px-2 py-0.5 text-xs font-bold text-white ${styles.bg} rounded-sm shadow-sm`}>
                    {(bbox.confidence * 100).toFixed(0)}%
                  </div>
                </div>
              );
            })}

            {!loading && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                  setPreview(null);
                  setResult(null);
                }}
                className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-sm transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-sm flex items-center animate-in slide-in-from-top-2">
          <svg className="w-5 h-5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {result && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-bottom-4 duration-500 fill-mode-backwards">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Analysis Report</h3>
              <span className={`px-3 py-1 text-xs font-bold tracking-wider uppercase rounded-full border ${styles.badge}`}>
                {result.severity}
              </span>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-sm text-zinc-500">Confidence Score</span>
                <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100">{(result.confidence * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-sm text-zinc-500">Detections</span>
                <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100">{result.bboxes.length} objects</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-sm text-zinc-500">Processing Latency</span>
                <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100">{result.latency_ms}ms</span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="text-sm text-zinc-500">Model Version</span>
                <span className="font-mono text-xs text-zinc-400">{result.model_version}</span>
              </div>
            </div>
          </div>

          <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Interpretation</h4>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
              {result.detected 
                ? "The system has detected presence of iron hydroxide precipitates ('Yellow Boy'). This indicates active Acid Mine Drainage (AMD) in the water source." 
                : "No significant visual indicators of Acid Mine Drainage were detected in this sample."}
            </p>
            
            {result.warnings && result.warnings.length > 0 && (
              <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                <h5 className="text-xs font-semibold text-yellow-600 dark:text-yellow-500 uppercase tracking-wider mb-2">System Warnings</h5>
                <ul className="text-xs text-zinc-500 space-y-1">
                  {result.warnings.map((w, i) => <li key={i}>• {w}</li>)}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
