"use client";

import React, { useState, useRef, useEffect } from "react";

interface LiveCameraViewProps {
  onStreamReady?: (stream: MediaStream) => void;
  onError?: (error: Error) => void;
}

export default function LiveCameraView({
  onStreamReady,
  onError,
}: LiveCameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string>("");
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const isSecureContext = isClient && navigator?.mediaDevices?.getUserMedia;

  const stopStream = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  };

  const enumerateDevices = async () => {
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
  };

  const startCamera = async () => {
    setIsStarting(true);
    setError("");
    setPermissionDenied(false);

    try {
      const constraints: MediaStreamConstraints = {
        video: selectedDeviceId
          ? { deviceId: { exact: selectedDeviceId } }
          : true,
        audio: false,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(
        constraints
      );

      setStream(mediaStream);

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
  };

  const handleDeviceChange = async (deviceId: string) => {
    setSelectedDeviceId(deviceId);

    if (stream) {
      stopStream();
      await new Promise((resolve) => setTimeout(resolve, 100));
      await startCamera();
    }
  };

  useEffect(() => {
    return () => {
      stopStream();
    };
  }, []);

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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        {!stream ? (
          <button
            onClick={startCamera}
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
              onClick={startCamera}
              className="mt-3 text-sm text-rose-700 dark:text-rose-400 underline hover:no-underline"
            >
              Try Again
            </button>
          )}
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
      </div>
    </div>
  );
}
