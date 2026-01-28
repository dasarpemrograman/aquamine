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
import { UploadCloud, Play, StopCircle, AlertTriangle } from "lucide-react";

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
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap bg-surface p-3 rounded-xl border border-white/5">
        <label
          htmlFor="video-upload"
          className="inline-flex items-center gap-2 px-4 py-2 bg-background hover:bg-white/5 border border-white/10 rounded-lg cursor-pointer transition-colors"
        >
          <UploadCloud size={18} className="text-primary" />
          <span className="text-sm font-medium text-foreground">
            Choose video
          </span>
          <span className="text-xs text-foreground-muted truncate max-w-[12rem] border-l border-white/10 pl-2 ml-1">
            {videoName || "mp4/webm/mov"}
          </span>
        </label>

        <input
          id="video-upload"
          type="file"
          accept="video/mp4,video/webm,video/mov,video/quicktime,.mp4,.webm,.mov"
          onChange={handleFileChange}
          className="sr-only"
        />

        <div className="h-8 w-px bg-white/10" />

        {!isInferenceActive ? (
          <button
            onClick={startInference}
            disabled={!videoUrl}
            className="flex items-center gap-2 px-4 py-2 bg-success hover:bg-success/90 disabled:bg-foreground-muted disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
          >
            <Play size={18} />
            Start Inference
          </button>
        ) : (
          <button
            onClick={stopInference}
            className="flex items-center gap-2 px-4 py-2 bg-warning hover:bg-warning/90 text-background font-medium rounded-lg transition-colors"
          >
            <StopCircle size={18} />
            Stop Inference
          </button>
        )}

        {isInferenceActive && isAnalyzing && (
          <div className="flex items-center gap-2 text-sm text-foreground-muted">
            <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
            Analyzing...
          </div>
        )}

        {lastAnalyzedAt && (
          <div className="text-xs text-foreground-muted ml-auto">
            Last: {lastAnalyzedAt.toLocaleTimeString()}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="text-danger w-5 h-5 flex-shrink-0" />
          <div>
            <div className="text-danger text-sm font-bold mb-1">
              Error
            </div>
            <p className="text-sm text-foreground-muted">{error}</p>
          </div>
        </div>
      )}

      {inferenceError && (
        <div className="bg-warning/10 border border-warning/20 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="text-warning w-5 h-5 flex-shrink-0" />
          <div>
            <div className="text-warning text-sm font-bold mb-1">
              Inference Error
            </div>
            <p className="text-sm text-foreground-muted">{inferenceError}</p>
          </div>
        </div>
      )}

      {analysisResult && (
        <div className="bg-surface border border-primary/20 rounded-xl p-4 animate-in slide-in-from-top-2">
          <div className="flex items-center justify-between mb-3">
            <div className="text-primary text-sm font-bold">
              Detection Result
            </div>
            <div className="text-xs text-foreground-muted">
              Latency: {analysisResult.latency_ms}ms
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="bg-background/50 p-2 rounded-lg">
              <span className="text-foreground-muted block mb-1">Detected</span>
              <span className="font-bold text-foreground text-sm">{analysisResult.detected ? "Yes" : "No"}</span>
            </div>
            <div className="bg-background/50 p-2 rounded-lg">
              <span className="text-foreground-muted block mb-1">Severity</span>
              <span className="font-bold text-foreground text-sm capitalize">{analysisResult.severity}</span>
            </div>
            <div className="bg-background/50 p-2 rounded-lg">
              <span className="text-foreground-muted block mb-1">Bboxes</span>
              <span className="font-bold text-foreground text-sm">{analysisResult.bboxes.length}</span>
            </div>
            <div className="bg-background/50 p-2 rounded-lg">
              <span className="text-foreground-muted block mb-1">Confidence</span>
              <span className="font-bold text-foreground text-sm">{(analysisResult.confidence * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>
      )}

      <div className="relative bg-black rounded-2xl overflow-hidden aspect-video w-full shadow-2xl border border-white/5">
        <video
          ref={videoRef}
          src={videoUrl ?? undefined}
          controls
          playsInline
          onEnded={stopInference}
          className="w-full h-full object-contain"
        />

        {!videoUrl && (
          <div className="absolute inset-0 flex items-center justify-center text-foreground-muted">
            <div className="text-center">
              <div className="text-6xl mb-4 opacity-20">🎥</div>
              <p className="text-sm font-medium">Choose a video to begin</p>
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
