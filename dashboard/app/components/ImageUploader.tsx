"use client";

import { useState, useRef, ChangeEvent, DragEvent } from "react";
import { analyzeImage, AnalysisResponse } from "@/lib/api";
import { Upload, X, Play, AlertTriangle, CheckCircle2, FileImage, Sparkles } from "lucide-react";

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
        badge: "bg-emerald-50/50 text-emerald-700 border-emerald-200"
      };
      case "mild": return {
        bg: "bg-yellow-500",
        text: "text-yellow-500",
        border: "border-yellow-500",
        badge: "bg-yellow-50/50 text-yellow-700 border-yellow-200"
      };
      case "moderate": return {
        bg: "bg-orange-500",
        text: "text-orange-500",
        border: "border-orange-500",
        badge: "bg-orange-50/50 text-orange-700 border-orange-200"
      };
      case "severe": return {
        bg: "bg-rose-500",
        text: "text-rose-500",
        border: "border-rose-500",
        badge: "bg-rose-50/50 text-rose-700 border-rose-200"
      };
      default: return {
        bg: "bg-slate-500",
        text: "text-slate-500",
        border: "border-slate-500",
        badge: "bg-slate-100/50 text-slate-700 border-slate-200"
      };
    }
  };

  const styles = result ? getSeverityStyles(result.severity) : getSeverityStyles("default");

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 p-4">
      <div 
        className={`
          group relative overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300 ease-out
          ${dragActive 
            ? "border-teal-500 bg-teal-50/50 scale-[1.01]" 
            : "border-slate-300 hover:border-teal-400 bg-white/40 backdrop-blur-sm"
          }
          ${preview ? "h-auto" : "h-80"}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {!preview && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className={`
              p-6 rounded-full bg-slate-50/50 backdrop-blur-sm mb-6 transition-transform duration-300 shadow-sm
              ${dragActive ? "scale-110 shadow-md" : "group-hover:scale-105"}
            `}>
              <Upload className="w-10 h-10 text-slate-400 group-hover:text-teal-500 transition-colors" />
            </div>
            <p className="text-xl font-medium text-slate-700">
              Drop image for analysis
            </p>
            <p className="text-sm text-slate-400 mt-2">
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

        {preview && (
          <div className="relative w-full">
            <img 
              ref={imgRef}
              src={preview} 
              alt="Analysis target" 
              className="w-full h-auto block rounded-xl shadow-inner"
              onLoad={handleImageLoad}
            />
            
            {preview && !loading && !result && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[2px] transition-all hover:bg-black/20">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (file) analyze(file);
                  }}
                  className="px-8 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold rounded-full shadow-lg transform transition-all hover:scale-105 active:scale-95 flex items-center gap-2 backdrop-blur-md"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>Run Analysis</span>
                </button>
              </div>
            )}

            {loading && (
              <div className="absolute inset-0 bg-teal-900/10 backdrop-blur-[1px] overflow-hidden rounded-xl">
                <div className="absolute inset-x-0 h-0.5 bg-teal-400 shadow-[0_0_15px_rgba(45,212,191,0.8)] animate-[scan_2s_ease-in-out_infinite]" />
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
                    boxShadow: '0 0 20px rgba(0,0,0,0.3)'
                  }}
                >
                  <div className={`absolute -top-7 left-0 px-2 py-0.5 text-xs font-bold text-background ${styles.bg} rounded-sm shadow-sm`}>
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
                className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/40 text-white rounded-full backdrop-blur-md transition-colors shadow-lg border border-white/20"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50/50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center animate-in slide-in-from-top-2 backdrop-blur-sm">
          <AlertTriangle className="w-5 h-5 mr-3 flex-shrink-0" />
          {error}
        </div>
      )}

      {result && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-bottom-4 duration-500 fill-mode-backwards">
          <div className="bg-white/60 backdrop-blur-xl border border-white/60 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <FileImage className="w-5 h-5 text-slate-400" />
                Analysis Report
              </h3>
              <span className={`px-3 py-1 text-xs font-bold tracking-wider uppercase rounded-full border ${styles.badge}`}>
                {result.severity}
              </span>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-slate-100/80">
                <span className="text-sm text-slate-500">Confidence Score</span>
                <span className="font-mono font-medium text-slate-900">{(result.confidence * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-100/80">
                <span className="text-sm text-slate-500">Detections</span>
                <span className="font-mono font-medium text-slate-900">{result.bboxes.length} objects</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-100/80">
                <span className="text-sm text-slate-500">Processing Latency</span>
                <span className="font-mono font-medium text-slate-900">{result.latency_ms}ms</span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="text-sm text-slate-500">Model Version</span>
                <span className="font-mono text-xs text-slate-400">{result.model_version}</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-50/50 backdrop-blur-sm border border-slate-200/60 rounded-2xl p-6">
            <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-500" />
              Interpretation
            </h4>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              {result.detected 
                ? "The system has detected presence of iron hydroxide precipitates ('Yellow Boy'). This indicates active Acid Mine Drainage (AMD) in the water source." 
                : "No significant visual indicators of Acid Mine Drainage were detected in this sample."}
            </p>
            
            {result.warnings && result.warnings.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-200/60">
                <h5 className="text-xs font-semibold text-yellow-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  System Warnings
                </h5>
                <ul className="text-xs text-slate-500 space-y-1 ml-1">
                  {result.warnings.map((w, i) => <li key={i} className="flex items-start gap-2">
                    <span className="mt-1 w-1 h-1 rounded-full bg-slate-400"></span>
                    {w}
                  </li>)}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
