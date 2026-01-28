"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { analyzeImage, type AnalysisResponse } from "@/lib/api";
import CVDetectionOverlay from "./CVDetectionOverlay";
import { GlassCard } from "@/app/components/ui/GlassCard";
import { Camera, StopCircle, Play, Square, AlertCircle, RefreshCw, Activity, Clock } from "lucide-react";

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
      <div className="bg-white/40 backdrop-blur-md border border-white/50 rounded-2xl p-8 text-center shadow-lg">
        <div className="text-slate-500 animate-pulse">Initializing system...</div>
      </div>
    );
  }

  if (!isSecureContext) {
    return (
      <div className="bg-rose-50/80 backdrop-blur-sm border border-rose-200 rounded-2xl p-8 text-center shadow-sm">
        <div className="text-rose-700 font-semibold mb-2 flex items-center justify-center gap-2">
          <AlertCircle className="w-5 h-5" />
          Camera Not Available
        </div>
        <p className="text-sm text-rose-600">
          Camera access requires a secure context (HTTPS or localhost).
          Please use <code className="bg-rose-100 px-1.5 py-0.5 rounded text-rose-800">https://</code> or <code className="bg-rose-100 px-1.5 py-0.5 rounded text-rose-800">http://localhost</code>.
        </p>
      </div>
    );
  }

  const originalWidth = analysisResult?.image_width ?? 1280;
  const originalHeight = analysisResult?.image_height ?? 720;
  const containerWidth = videoRef.current?.clientWidth || 800;
  const containerHeight = videoRef.current?.clientHeight || 600;

  return (
    <div className="space-y-6 p-4">
      <GlassCard className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {!stream ? (
              <button
                onClick={() => void startCamera()}
                disabled={isStarting}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95"
              >
                {isStarting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
                {isStarting ? "Starting..." : "Start Camera"}
              </button>
          ) : (
            <>
              <button
                onClick={stopStream}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold rounded-xl transition-colors border border-rose-200"
              >
                <StopCircle className="w-4 h-4" />
                Stop Camera
              </button>

              {devices.length > 1 && (
                <select
                  value={selectedDeviceId}
                  onChange={(e) => handleDeviceChange(e.target.value)}
                  className="px-3 py-2.5 bg-white/50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-teal-500 outline-none"
                >
                  {devices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                    </option>
                  ))}
                </select>
              )}

              <div className="h-8 w-px bg-slate-200/60 mx-1" />

              {!isInferenceActive ? (
                <button
                  onClick={startInference}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 font-semibold rounded-xl transition-colors border border-emerald-200 shadow-sm"
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
            </>
          )}
        </div>

        <div className="flex items-center gap-4">
          {isInferenceActive && isAnalyzing && (
            <div className="flex items-center gap-2 text-sm text-slate-600 bg-white/50 px-3 py-1.5 rounded-full border border-white/60">
              <div className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </div>
              <span className="font-medium">Analyzing</span>
            </div>
          )}

          {lastAnalyzedAt && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Clock className="w-3.5 h-3.5" />
              <span>{lastAnalyzedAt.toLocaleTimeString()}</span>
            </div>
          )}
        </div>
      </GlassCard>

      {error && (
        <div className="bg-rose-50/80 backdrop-blur-sm border border-rose-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5" />
          <div>
            <div className="text-rose-700 text-sm font-semibold">
              {permissionDenied ? "Permission Denied" : "Error"}
            </div>
            <p className="text-sm text-rose-600 mt-1">{error}</p>
            {permissionDenied && (
              <button
                onClick={() => void startCamera()}
                className="mt-2 text-sm text-rose-700 underline hover:no-underline font-medium"
              >
                Try Again
              </button>
            )}
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
          autoPlay
          playsInline
          muted
          className="w-full h-full object-contain"
        />
        
        {!stream && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 bg-slate-50/50 backdrop-blur-sm">
            <div className="p-6 bg-white/50 rounded-full mb-4 shadow-sm ring-1 ring-slate-200/50">
              <Camera className="w-12 h-12 text-slate-300" />
            </div>
            <p className="text-lg font-medium text-slate-600">Camera Feed Offline</p>
            <p className="text-sm text-slate-400">Click "Start Camera" to begin analysis</p>
          </div>
        )}

        {stream && analysisResult && (
          <div className="absolute top-4 right-4 w-64 bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-4 text-white shadow-xl transition-opacity hover:bg-black/50">
            <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-teal-400" />
                <span className="text-sm font-semibold">Live Results</span>
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
