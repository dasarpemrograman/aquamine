"use client";

import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { analyzeImage, type AnalysisResponse } from "@/lib/api";
import CVDetectionOverlay from "./CVDetectionOverlay";
import { Upload, FileVideo, Play, Square, AlertCircle, Activity, X } from "lucide-react";

export type VideoFileViewHandle = {
  clearVideo: () => void;
};

interface VideoFileViewProps {
  onVideoUrlChange?: (url: string | null) => void;
}

const VideoFileView = React.forwardRef<VideoFileViewHandle, VideoFileViewProps>(function VideoFileView(
  { onVideoUrlChange },
  ref
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isAnalyzingRef = useRef(false);

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoName, setVideoName] = useState<string>("");
  const [error, setError] = useState<string>("");

  const [isInferenceActive, setIsInferenceActive] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<Date | null>(null);
  const [inferenceError, setInferenceError] = useState<string>("");

  const stopInference = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsInferenceActive(false);
    setIsAnalyzing(false);
    isAnalyzingRef.current = false;
  }, []);

  const clearResults = useCallback(() => {
    setAnalysisResult(null);
    setLastAnalyzedAt(null);
    setInferenceError("");
  }, []);

  const clearVideo = useCallback(() => {
    stopInference();
    clearResults();
    setError("");

    setVideoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setVideoName("");

    if (onVideoUrlChange) {
      onVideoUrlChange(null);
    }
  }, [clearResults, onVideoUrlChange, stopInference]);

  useImperativeHandle(
    ref,
    () => ({
      clearVideo,
    }),
    [clearVideo]
  );

  const captureFrame = useCallback(async (): Promise<File | null> => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      return null;
    }

    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
    }

    const canvas = canvasRef.current;
    const maxWidth = 1280;
    let width = video.videoWidth;
    let height = video.videoHeight;

    if (width > maxWidth) {
      height = (height * maxWidth) / width;
      width = maxWidth;
    }

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, width, height);

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(null);
            return;
          }

          resolve(
            new File([blob], `video-frame-${Date.now()}.jpg`, {
              type: "image/jpeg",
            })
          );
        },
        "image/jpeg",
        0.85
      );
    });
  }, []);

  const runInference = useCallback(async () => {
    if (!videoUrl) return;
    if (isAnalyzingRef.current) return;
    if (document.visibilityState !== "visible") return;

    const video = videoRef.current;
    if (!video || video.paused || video.ended) {
      return;
    }

    try {
      isAnalyzingRef.current = true;
      setIsAnalyzing(true);
      setInferenceError("");

      const frame = await captureFrame();
      if (!frame) return;

      const result = await analyzeImage(frame);
      setAnalysisResult(result);
      setLastAnalyzedAt(new Date());
    } catch (err: any) {
      console.error("Video inference error:", err);
      setInferenceError(err?.message || "Analysis failed");
    } finally {
      isAnalyzingRef.current = false;
      setIsAnalyzing(false);
    }
  }, [captureFrame, videoUrl]);

  const startInference = useCallback(() => {
    if (!videoUrl || intervalRef.current) return;

    setIsInferenceActive(true);
    setInferenceError("");

    runInference();
    intervalRef.current = setInterval(() => {
      runInference();
    }, 1000);
  }, [runInference, videoUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    clearVideo();

    const nextUrl = URL.createObjectURL(file);
    if (onVideoUrlChange) {
      onVideoUrlChange(nextUrl);
    }
    setVideoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return nextUrl;
    });
    setVideoName(file.name);
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        stopInference();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [stopInference]);

  useEffect(() => {
    return () => {
      stopInference();
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }

      if (onVideoUrlChange) {
        onVideoUrlChange(null);
      }
    };
  }, [onVideoUrlChange, stopInference, videoUrl]);

  const originalWidth = analysisResult?.image_width ?? 1280;
  const originalHeight = analysisResult?.image_height ?? 720;
  const containerWidth = videoRef.current?.clientWidth || 800;
  const containerHeight = videoRef.current?.clientHeight || 600;

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between gap-4 flex-wrap bg-white/40 backdrop-blur-md p-4 rounded-2xl border border-white/60 shadow-sm">
        <div className="flex items-center gap-3 flex-1">
          <label
            htmlFor="video-upload"
            className="inline-flex items-center gap-3 px-4 py-2.5 bg-white/50 hover:bg-white/80 border border-slate-200 hover:border-teal-300 rounded-xl cursor-pointer transition-all shadow-sm group"
          >
            <div className="p-1.5 bg-slate-100 rounded-lg group-hover:bg-teal-50 group-hover:text-teal-600 transition-colors">
              <Upload className="w-4 h-4 text-slate-500 group-hover:text-teal-600" />
            </div>
            <div className="flex flex-col items-start">
              <span className="text-sm font-medium text-slate-700 group-hover:text-teal-800 transition-colors">
                {videoName ? "Change video" : "Choose video"}
              </span>
              {videoName && (
                <span className="text-[10px] text-slate-400 truncate max-w-[12rem]">
                  {videoName}
                </span>
              )}
            </div>
          </label>

          <input
            id="video-upload"
            type="file"
            accept="video/mp4,video/webm,video/mov,video/quicktime,.mp4,.webm,.mov"
            onChange={handleFileChange}
            className="sr-only"
          />

          <div className="h-8 w-px bg-slate-200/60 mx-1" />

          {!isInferenceActive ? (
            <button
              onClick={startInference}
              disabled={!videoUrl}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all shadow-md"
            >
              <Play className="w-4 h-4 fill-current" />
              Start Inference
            </button>
          ) : (
            <button
              onClick={stopInference}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-50 hover:bg-orange-100 text-orange-600 font-semibold rounded-xl transition-colors border border-orange-200 shadow-sm"
            >
              <Square className="w-4 h-4 fill-current" />
              Stop Inference
            </button>
          )}
        </div>

        {isInferenceActive && isAnalyzing && (
          <div className="flex items-center gap-2 text-sm text-slate-600 bg-white/50 px-3 py-1.5 rounded-full border border-white/60">
            <div className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </div>
            <span className="font-medium">Analyzing Frame...</span>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-rose-50/80 backdrop-blur-sm border border-rose-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5" />
          <div>
            <div className="text-rose-700 text-sm font-semibold">Error</div>
            <p className="text-sm text-rose-600 mt-1">{error}</p>
          </div>
        </div>
      )}

      {inferenceError && (
        <div className="bg-orange-50/80 backdrop-blur-sm border border-orange-200 rounded-2xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-orange-600" />
          <div>
            <div className="text-orange-700 text-sm font-semibold">Inference Error</div>
            <p className="text-sm text-orange-600">{inferenceError}</p>
          </div>
        </div>
      )}

      <div className="relative bg-slate-900 rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/10 aspect-video group">
        <video
          ref={videoRef}
          src={videoUrl ?? undefined}
          controls
          playsInline
          onEnded={stopInference}
          className="w-full h-full object-contain"
        />

        {!videoUrl && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 bg-slate-50/50 backdrop-blur-sm">
            <div className="p-6 bg-white/50 rounded-full mb-4 shadow-sm ring-1 ring-slate-200/50">
              <FileVideo className="w-12 h-12 text-slate-300" />
            </div>
            <p className="text-lg font-medium text-slate-600">No Video Selected</p>
            <p className="text-sm text-slate-400">Upload a video file to begin analysis</p>
          </div>
        )}

        {videoUrl && analysisResult && (
          <div className="absolute top-4 right-4 w-64 bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-4 text-white shadow-xl transition-opacity hover:bg-black/50 z-10 pointer-events-none">
            <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-teal-400" />
                <span className="text-sm font-semibold">Frame Analysis</span>
              </div>
              <span className="text-[10px] font-mono text-slate-300 bg-white/10 px-1.5 py-0.5 rounded">
                {analysisResult.latency_ms}ms
              </span>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-300">Detected</span>
                <span className={`font-semibold ${analysisResult.detected ? "text-amber-400" : "text-emerald-400"}`}>
                  {analysisResult.detected ? "Yes" : "No"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Severity</span>
                <span className="capitalize font-medium">{analysisResult.severity}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Objects</span>
                <span className="font-mono">{analysisResult.bboxes.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Confidence</span>
                <span className="font-mono">{(analysisResult.confidence * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>
        )}

        {videoUrl && analysisResult && analysisResult.bboxes.length > 0 && (
          <CVDetectionOverlay
            bboxes={analysisResult.bboxes}
            severity={analysisResult.severity}
            containerSize={{ width: containerWidth, height: containerHeight }}
            originalSize={{ width: originalWidth, height: originalHeight }}
          />
        )}
      </div>
    </div>
  );
});

export default VideoFileView;
