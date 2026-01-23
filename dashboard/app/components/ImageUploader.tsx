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
    
    analyze(selectedFile);
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

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "none": return "text-green-600 bg-green-100 border-green-200 dark:bg-green-900/30 dark:border-green-800 dark:text-green-400";
      case "mild": return "text-yellow-600 bg-yellow-100 border-yellow-200 dark:bg-yellow-900/30 dark:border-yellow-800 dark:text-yellow-400";
      case "moderate": return "text-orange-600 bg-orange-100 border-orange-200 dark:bg-orange-900/30 dark:border-orange-800 dark:text-orange-400";
      case "severe": return "text-red-600 bg-red-100 border-red-200 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400";
      default: return "text-zinc-600 bg-zinc-100 border-zinc-200";
    }
  };
  
  const getBoxColor = (severity: string) => {
    switch (severity) {
      case "none": return "border-green-500 bg-green-500/20";
      case "mild": return "border-yellow-500 bg-yellow-500/20";
      case "moderate": return "border-orange-500 bg-orange-500/20";
      case "severe": return "border-red-500 bg-red-500/20";
      default: return "border-zinc-500";
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-8">
      <div 
        className={`
          relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200
          ${dragActive 
            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/10" 
            : "border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600 bg-white dark:bg-zinc-900"
          }
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input 
          type="file" 
          id="image-upload" 
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          onChange={handleChange}
          accept="image/png, image/jpeg, image/jpg"
          disabled={loading}
        />
        
        <div className="flex flex-col items-center justify-center space-y-4 pointer-events-none">
          <div className="p-4 bg-zinc-100 dark:bg-zinc-800 rounded-full">
            <svg className="w-8 h-8 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
              Drop image here or click to upload
            </p>
            <p className="text-sm text-zinc-500 mt-1">
              Supports PNG, JPG up to 10MB
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900 dark:border-white"></div>
          <span className="ml-3 text-zinc-600 dark:text-zinc-400">Analyzing image...</span>
        </div>
      )}

      {preview && !loading && (
        <div className="space-y-6">
          <div className="relative rounded-lg overflow-hidden bg-black border border-zinc-200 dark:border-zinc-800">
            <img 
              ref={imgRef}
              src={preview} 
              alt="Uploaded analysis target" 
              className="w-full h-auto block"
              onLoad={handleImageLoad}
            />
            
            {result && renderedSize.width > 0 && result.bboxes.map((bbox, i) => {
              const scaleX = renderedSize.width / result.image_width;
              const scaleY = renderedSize.height / result.image_height;
              
              const style = {
                left: `${bbox.x * scaleX}px`,
                top: `${bbox.y * scaleY}px`,
                width: `${bbox.width * scaleX}px`,
                height: `${bbox.height * scaleY}px`,
              };

              return (
                <div 
                  key={i}
                  className={`absolute border-2 ${getBoxColor(result.severity)} transition-all duration-300`}
                  style={style}
                >
                  <span className="absolute -top-6 left-0 text-xs font-bold text-white bg-black/70 px-1 py-0.5 rounded">
                    {(bbox.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>

          {result && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Analysis Results</h3>
                  <p className="text-sm text-zinc-500">Model: {result.model_version}</p>
                </div>
                <div className={`px-4 py-1.5 rounded-full text-sm font-semibold border ${getSeverityColor(result.severity)}`}>
                  {result.severity.toUpperCase()}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                  <div className="text-sm text-zinc-500 mb-1">Confidence</div>
                  <div className="text-2xl font-mono font-medium text-zinc-900 dark:text-zinc-100">
                    {(result.confidence * 100).toFixed(1)}%
                  </div>
                </div>
                
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                  <div className="text-sm text-zinc-500 mb-1">Processing Time</div>
                  <div className="text-2xl font-mono font-medium text-zinc-900 dark:text-zinc-100">
                    {result.latency_ms}ms
                  </div>
                </div>
                
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                  <div className="text-sm text-zinc-500 mb-1">Detections</div>
                  <div className="text-2xl font-mono font-medium text-zinc-900 dark:text-zinc-100">
                    {result.bboxes.length}
                  </div>
                </div>

                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                  <div className="text-sm text-zinc-500 mb-1">Resolution</div>
                  <div className="text-lg font-mono font-medium text-zinc-900 dark:text-zinc-100">
                    {result.image_width}x{result.image_height}
                  </div>
                </div>
              </div>
              
              {result.warnings && result.warnings.length > 0 && (
                <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/10 text-yellow-800 dark:text-yellow-200 text-sm rounded border border-yellow-200 dark:border-yellow-800/30">
                  <div className="font-semibold mb-1">Warnings:</div>
                  <ul className="list-disc list-inside">
                    {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
