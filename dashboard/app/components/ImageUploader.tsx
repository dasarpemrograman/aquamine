"use client";

import { useState, useRef, ChangeEvent, DragEvent } from "react";
import { analyzeImage, AnalysisResponse } from "@/lib/api";
import { UploadCloud, X, Camera, Zap, AlertTriangle, CheckCircle2 } from "lucide-react";

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
        bg: "bg-success",
        text: "text-success",
        border: "border-success",
        badge: "bg-success/10 text-success border-success/20"
      };
      case "mild": return {
        bg: "bg-warning",
        text: "text-warning",
        border: "border-warning",
        badge: "bg-warning/10 text-warning border-warning/20"
      };
      case "moderate": return {
        bg: "bg-orange-500",
        text: "text-orange-500",
        border: "border-orange-500",
        badge: "bg-orange-500/10 text-orange-500 border-orange-500/20"
      };
      case "severe": return {
        bg: "bg-danger",
        text: "text-danger",
        border: "border-danger",
        badge: "bg-danger/10 text-danger border-danger/20"
      };
      default: return {
        bg: "bg-foreground-muted",
        text: "text-foreground-muted",
        border: "border-foreground-muted",
        badge: "bg-surface text-foreground-muted border-white/10"
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
            ? "border-primary bg-primary/5 scale-[1.01]" 
            : "border-white/10 hover:border-primary/50 bg-background/50"
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
              p-4 rounded-full bg-surface mb-4 transition-transform duration-300 border border-white/5
              ${dragActive ? "scale-110 shadow-lg shadow-primary/20" : "group-hover:scale-105"}
            `}>
              <UploadCloud className={`w-8 h-8 ${dragActive ? "text-primary" : "text-foreground-muted"}`} />
            </div>
            <p className="text-lg font-medium text-foreground">
              Drop image for analysis
            </p>
            <p className="text-sm text-foreground-muted mt-2">
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
              className="w-full h-auto block rounded-xl"
              onLoad={handleImageLoad}
            />
            
            {preview && !loading && !result && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] transition-all opacity-0 hover:opacity-100">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (file) analyze(file);
                  }}
                  className="px-8 py-3 bg-primary hover:bg-primary-glow text-background font-bold rounded-full shadow-lg shadow-primary/20 transform transition-all hover:scale-105 active:scale-95 flex items-center space-x-2"
                >
                  <Zap className="w-5 h-5" />
                  <span>Run Analysis</span>
                </button>
              </div>
            )}

            {loading && (
              <div className="absolute inset-0 bg-primary/10 overflow-hidden">
                <div className="absolute inset-x-0 h-0.5 bg-primary-glow shadow-[0_0_15px_rgba(34,211,238,0.8)] animate-[scan_2s_ease-in-out_infinite]" />
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
                className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full backdrop-blur-sm transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-danger/10 border border-danger/20 rounded-xl text-danger text-sm flex items-center animate-in slide-in-from-top-2">
          <AlertTriangle className="w-5 h-5 mr-3 flex-shrink-0" />
          {error}
        </div>
      )}

      {result && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-bottom-4 duration-500 fill-mode-backwards">
          <div className="bg-surface border border-white/5 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-foreground">Analysis Report</h3>
              <span className={`px-3 py-1 text-xs font-bold tracking-wider uppercase rounded-full border ${styles.badge}`}>
                {result.severity}
              </span>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-white/5">
                <span className="text-sm text-foreground-muted">Confidence Score</span>
                <span className="font-mono font-medium text-foreground">{(result.confidence * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-white/5">
                <span className="text-sm text-foreground-muted">Detections</span>
                <span className="font-mono font-medium text-foreground">{result.bboxes.length} objects</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-white/5">
                <span className="text-sm text-foreground-muted">Processing Latency</span>
                <span className="font-mono font-medium text-foreground">{result.latency_ms}ms</span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="text-sm text-foreground-muted">Model Version</span>
                <span className="font-mono text-xs text-foreground-muted opacity-50">{result.model_version}</span>
              </div>
            </div>
          </div>

          <div className="bg-surface/50 border border-white/5 rounded-2xl p-6">
            <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" /> Interpretation
            </h4>
            <p className="text-sm text-foreground-muted leading-relaxed mb-4">
              {result.detected 
                ? "The system has detected presence of iron hydroxide precipitates ('Yellow Boy'). This indicates active Acid Mine Drainage (AMD) in the water source." 
                : "No significant visual indicators of Acid Mine Drainage were detected in this sample."}
            </p>
            
            {result.warnings && result.warnings.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/5">
                <h5 className="text-xs font-bold text-warning uppercase tracking-wider mb-2">System Warnings</h5>
                <ul className="text-xs text-foreground-muted space-y-1">
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
