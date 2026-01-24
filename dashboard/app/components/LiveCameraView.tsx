"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { analyzeImage, type AnalysisResponse } from "@/lib/api";
import CVDetectionOverlay from "./CVDetectionOverlay";

interface LiveCameraViewProps {
  onStreamReady?: (stream: MediaStream) => void;
  onError?: (error: Error) => void;
}

export default function LiveCameraView({
  onStreamReady,
  onError,
}: LiveCameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isAnalyzingRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string>("");
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [isClient, setIsClient] = useState(false);

  const [isInferenceActive, setIsInferenceActive] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<Date | null>(null);
  const [inferenceError, setInferenceError] = useState<string>("");

  useEffect(() => {
    setIsClient(true);
  }, []);

  const isSecureContext = isClient && navigator?.mediaDevices?.getUserMedia;

  const stopInference = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsInferenceActive(false);
    setIsAnalyzing(false);
    isAnalyzingRef.current = false;
  }, []);

  const stopStream = useCallback(() => {
    stopInference();
    setAnalysisResult(null);
    setLastAnalyzedAt(null);
    setInferenceError("");

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setStream(null);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stopInference]);

  const enumerateDevices = useCallback(async () => {
    try {
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = deviceList.filter((d) => d.kind === "videoinput");
      setDevices(videoDevices);

      const droidCam = videoDevices.find((d) =>
        d.label.toLowerCase().includes("droidcam")
      );
      const defaultDevice = droidCam || videoDevices[0];
      if (defaultDevice) {
        setSelectedDeviceId(defaultDevice.deviceId);
      }
    } catch (err) {
      console.error("Failed to enumerate devices:", err);
    }
  }, []);

  const startCamera = useCallback(async (deviceId?: string) => {
    setIsStarting(true);
    setError("");
    setPermissionDenied(false);
    setInferenceError("");
    setAnalysisResult(null);
    setLastAnalyzedAt(null);

    try {
      stopStream();

      const targetDeviceId = deviceId ?? selectedDeviceId;
      const constraints: MediaStreamConstraints = {
        video: targetDeviceId
          ? { deviceId: { exact: targetDeviceId } }
          : true,
        audio: false,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(
        constraints
      );

      setStream(mediaStream);
      streamRef.current = mediaStream;

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }

      await enumerateDevices();

      if (onStreamReady) {
        onStreamReady(mediaStream);
      }
    } catch (err: any) {
      console.error("Failed to start camera:", err);

      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setPermissionDenied(true);
        setError("Camera permission denied. Please allow camera access and try again.");
      } else if (err.name === "NotFoundError") {
        setError("No camera device found. Please connect a camera or use another mode.");
      } else if (err.name === "NotReadableError") {
        setError("Camera is already in use by another application.");
      } else {
        setError(`Camera error: ${err.message || "Unknown error"}`);
      }

      if (onError) {
        onError(err);
      }
    } finally {
      setIsStarting(false);
    }
  }, [enumerateDevices, onError, onStreamReady, selectedDeviceId, stopStream]);

  const handleDeviceChange = async (deviceId: string) => {
    setSelectedDeviceId(deviceId);

    if (streamRef.current) {
      await startCamera(deviceId);
    }
  };

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
          if (blob) {
            const file = new File([blob], `snapshot-${Date.now()}.jpg`, {
              type: "image/jpeg",
            });
            resolve(file);
          } else {
            resolve(null);
          }
        },
        "image/jpeg",
        0.85
      );
    });
  }, []);

  const runInference = useCallback(async () => {
    if (isAnalyzingRef.current) {
      return;
    }

    if (document.visibilityState !== "visible") {
      return;
    }

    const video = videoRef.current;
    if (!video || video.paused || video.ended) {
      return;
    }

    try {
      isAnalyzingRef.current = true;
      setIsAnalyzing(true);
      setInferenceError("");

      const frame = await captureFrame();
      if (!frame) {
        return;
      }

      const result = await analyzeImage(frame);
      setAnalysisResult(result);
      setLastAnalyzedAt(new Date());
    } catch (err: any) {
      console.error("Inference error:", err);
      setInferenceError(err.message || "Analysis failed");
    } finally {
      isAnalyzingRef.current = false;
      setIsAnalyzing(false);
    }
  }, [captureFrame]);

  const startInference = useCallback(() => {
    if (!stream || intervalRef.current) return;

    setIsInferenceActive(true);
    setInferenceError("");

    runInference();

    intervalRef.current = setInterval(() => {
      runInference();
    }, 1000);
  }, [stream, runInference]);

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
      stopStream();
    };
  }, [stopStream]);

  if (!isClient) {
    return (
      <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 text-center">
        <div className="text-zinc-500 dark:text-zinc-400">Loading...</div>
      </div>
    );
  }

  if (!isSecureContext) {
    return (
      <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-lg p-6 text-center">
        <div className="text-rose-700 dark:text-rose-400 font-semibold mb-2">
          Camera Not Available
        </div>
        <p className="text-sm text-rose-600 dark:text-rose-500">
          Camera access requires a secure context (HTTPS or localhost).
          Please use <code className="bg-rose-100 dark:bg-rose-900 px-1 rounded">https://</code> or <code className="bg-rose-100 dark:bg-rose-900 px-1 rounded">http://localhost</code>.
        </p>
      </div>
    );
  }

  const originalWidth = analysisResult?.image_width ?? 1280;
  const originalHeight = analysisResult?.image_height ?? 720;
  const containerWidth = videoRef.current?.clientWidth || 800;
  const containerHeight = videoRef.current?.clientHeight || 600;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        {!stream ? (
            <button
              onClick={() => void startCamera()}
              disabled={isStarting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-400 text-white font-medium rounded-lg transition-colors"
            >
              {isStarting ? "Starting..." : "Start Camera"}
            </button>
        ) : (
          <>
            <button
              onClick={stopStream}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-lg transition-colors"
            >
              Stop Camera
            </button>

            {devices.length > 1 && (
              <select
                value={selectedDeviceId}
                onChange={(e) => handleDeviceChange(e.target.value)}
                className="px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm"
              >
                {devices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                  </option>
                ))}
              </select>
            )}

            <div className="h-8 w-px bg-zinc-300 dark:bg-zinc-700" />

            {!isInferenceActive ? (
              <button
                onClick={startInference}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors"
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
          </>
        )}
      </div>

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-lg p-4">
          <div className="text-rose-700 dark:text-rose-400 text-sm font-medium mb-1">
            {permissionDenied ? "Permission Denied" : "Error"}
          </div>
          <p className="text-sm text-rose-600 dark:text-rose-500">{error}</p>
            {permissionDenied && (
              <button
                onClick={() => void startCamera()}
                className="mt-3 text-sm text-rose-700 dark:text-rose-400 underline hover:no-underline"
              >
                Try Again
              </button>
            )}
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
              <span className="font-medium">{analysisResult.detected ? "Yes" : "No"}</span>
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
              <span className="font-medium">{(analysisResult.confidence * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>
      )}

      <div className="relative bg-zinc-900 rounded-lg overflow-hidden aspect-video max-w-4xl">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-contain"
        />
        {!stream && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-400">
            <div className="text-center">
              <div className="text-6xl mb-4">📷</div>
              <p className="text-sm">Click "Start Camera" to begin</p>
            </div>
          </div>
        )}
        {stream && analysisResult && analysisResult.bboxes.length > 0 && (
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
}
