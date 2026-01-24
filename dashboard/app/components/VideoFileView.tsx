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
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <label
          htmlFor="video-upload"
          className="inline-flex items-center gap-3 px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg cursor-pointer"
        >
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Choose video
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-[18rem]">
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

        <div className="h-8 w-px bg-zinc-300 dark:bg-zinc-700" />

        {!isInferenceActive ? (
          <button
            onClick={startInference}
            disabled={!videoUrl}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-400 text-white font-medium rounded-lg transition-colors"
          >
            Start Inference
          </button>
        ) : (
          <button
            onClick={stopInference}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg transition-colors"
          >
            Stop Inference
          </button>
        )}

        {isInferenceActive && isAnalyzing && (
          <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            Analyzing...
          </div>
        )}

        {lastAnalyzedAt && (
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            Last: {lastAnalyzedAt.toLocaleTimeString()}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-lg p-4">
          <div className="text-rose-700 dark:text-rose-400 text-sm font-medium mb-1">
            Error
          </div>
          <p className="text-sm text-rose-600 dark:text-rose-500">{error}</p>
        </div>
      )}

      {inferenceError && (
        <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
          <div className="text-orange-700 dark:text-orange-400 text-sm font-medium mb-1">
            Inference Error
          </div>
          <p className="text-sm text-orange-600 dark:text-orange-500">{inferenceError}</p>
        </div>
      )}

      {analysisResult && (
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-blue-700 dark:text-blue-400 text-sm font-medium">
              Detection Result
            </div>
            <div className="text-xs text-blue-600 dark:text-blue-500">
              Latency: {analysisResult.latency_ms}ms
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-zinc-600 dark:text-zinc-400">Detected:</span>{" "}
              <span className="font-medium">
                {analysisResult.detected ? "Yes" : "No"}
              </span>
            </div>
            <div>
              <span className="text-zinc-600 dark:text-zinc-400">Severity:</span>{" "}
              <span className="font-medium capitalize">{analysisResult.severity}</span>
            </div>
            <div>
              <span className="text-zinc-600 dark:text-zinc-400">Bboxes:</span>{" "}
              <span className="font-medium">{analysisResult.bboxes.length}</span>
            </div>
            <div>
              <span className="text-zinc-600 dark:text-zinc-400">Confidence:</span>{" "}
              <span className="font-medium">
                {(analysisResult.confidence * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="relative bg-zinc-900 rounded-lg overflow-hidden aspect-video max-w-4xl">
        <video
          ref={videoRef}
          src={videoUrl ?? undefined}
          controls
          playsInline
          onEnded={stopInference}
          className="w-full h-full object-contain"
        />

        {!videoUrl && (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-400">
            <div className="text-center">
              <div className="text-6xl mb-4">🎥</div>
              <p className="text-sm">Choose a video to begin</p>
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
