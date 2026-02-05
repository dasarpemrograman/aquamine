"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { analyzeImage, fetchAlerts, attachEvidenceToAlert, type AnalysisResponse, type Alert } from "@/lib/api";
import CVDetectionOverlay from "./CVDetectionOverlay";
import { GlassCard } from "@/app/components/ui/GlassCard";
import { Camera, RefreshCw, AlertCircle, FileText, Save, Repeat, X, CheckCircle2, AlertTriangle, ChevronDown, Paperclip, Zap, Square } from "lucide-react";
import { useFieldMode } from "../context/FieldModeContext";
import { useAuth } from "@clerk/nextjs";

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
  const streamRef = useRef<MediaStream | null>(null);

  // Device management
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string>("");
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [isClient, setIsClient] = useState(false);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);
  const [isRealTimeMode, setIsRealTimeMode] = useState(true);
  const [isInferenceRunning, setIsInferenceRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isAnalyzingRef = useRef(false);
  
  const [showAttachModal, setShowAttachModal] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(false);
  const [selectedAlertId, setSelectedAlertId] = useState<number | null>(null);
  const [attachSuccess, setAttachSuccess] = useState(false);
  const [isAttaching, setIsAttaching] = useState(false);
  
  const { isFieldMode } = useFieldMode();
  const { getToken } = useAuth();

  useEffect(() => {
    setIsClient(true);
    enumerateDevices();
    
    // Auto-start camera if not already started
    if (!stream && !permissionDenied) {
        startCamera();
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStream();
    };
  }, []);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setStream(null);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const enumerateDevices = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = deviceList.filter((d) => d.kind === "videoinput");
      setDevices(videoDevices);

      // Prefer back camera on mobile or DroidCam
      const backCamera = videoDevices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment'));
      const droidCam = videoDevices.find((d) => d.label.toLowerCase().includes("droidcam"));
      
      const defaultDevice = backCamera || droidCam || videoDevices[0];
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

    try {
      stopStream();

      const targetDeviceId = deviceId ?? selectedDeviceId;
      // Industrial grade constraints: prioritize resolution and frame rate
      const constraints: MediaStreamConstraints = {
        video: targetDeviceId
          ? { 
              deviceId: { exact: targetDeviceId },
              width: { ideal: 1920 },
              height: { ideal: 1080 } 
            }
          : { 
              facingMode: "environment",
              width: { ideal: 1920 },
              height: { ideal: 1080 }
            },
        audio: false,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

      setStream(mediaStream);
      streamRef.current = mediaStream;

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        // Don't await play() - it can throw AbortError if interrupted, but video still works
        videoRef.current.play().catch((e) => {
          // AbortError is harmless - just means play was interrupted by another call
          if (e.name !== 'AbortError') {
            console.error("Video play error:", e);
          }
        });
      }

      await enumerateDevices();

      if (onStreamReady) {
        onStreamReady(mediaStream);
      }
    } catch (err: unknown) {
      console.error("Failed to start camera:", err);
      const error = err as Error & { name?: string };
      
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        setPermissionDenied(true);
        setError("Izin kamera ditolak. Mohon izinkan akses kamera.");
      } else if (error.name === "NotFoundError") {
        setError("Kamera tidak ditemukan.");
      } else {
        setError(`Gagal membuka kamera: ${error.message || "Unknown error"}`);
      }

      if (onError) onError(error);
    } finally {
      setIsStarting(false);
    }
  }, [enumerateDevices, onError, onStreamReady, selectedDeviceId, stopStream]);

  const handleDeviceChange = async (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    await startCamera(deviceId);
  };

  const captureAndAnalyze = useCallback(async () => {
    const video = videoRef.current;
    if (!stream) {
      setError("Kamera belum aktif. Izinkan akses kamera lalu coba lagi.");
      void startCamera();
      return;
    }

    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setError("Kamera belum siap. Tunggu 1-2 detik lalu coba lagi.");
      return;
    }

    try {
        setIsAnalyzing(true);

        // 1. Capture High-Res Frame
        if (!canvasRef.current) canvasRef.current = document.createElement("canvas");
        const canvas = canvasRef.current;
        
        // Match video resolution exactly
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not get canvas context");
        
        // Draw the current video frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // 2. Set Captured Image State (freezes the view for the user)
        const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
        setCapturedImage(dataUrl);

        // 3. Convert to Blob for API
        canvas.toBlob(async (blob) => {
            if (!blob) {
                setError("Gagal mengambil gambar.");
                setIsAnalyzing(false);
                return;
            }
            
            // 4. Run Analysis
            try {
                const result = await analyzeImage(new File([blob], "capture.jpg", { type: "image/jpeg" }));
                setAnalysisResult(result);
            } catch (err) {
                console.error("Analysis failed:", err);
                setError("Analisis gagal. Silakan coba lagi.");
            } finally {
                setIsAnalyzing(false);
            }
        }, "image/jpeg", 0.9);

    } catch (err) {
        console.error("Capture failed:", err);
        setError("Gagal mengambil gambar.");
        setIsAnalyzing(false);
    }
  }, [startCamera, stream]);

  const handleRetake = () => {
    setCapturedImage(null);
    setAnalysisResult(null);
    setError("");
    setAttachSuccess(false);
    setSelectedAlertId(null);
    if (videoRef.current && streamRef.current) {
        videoRef.current.play().catch(console.error);
    }
  };

  const loadAlerts = useCallback(async () => {
    setIsLoadingAlerts(true);
    try {
      const token = await getToken();
      const alertsData = await fetchAlerts(token);
      const activeAlerts = alertsData.filter(a => !a.resolved_at);
      setAlerts(activeAlerts);
    } catch (err) {
      console.error("Failed to load alerts:", err);
    } finally {
      setIsLoadingAlerts(false);
    }
  }, [getToken]);

  const handleOpenAttachModal = () => {
    loadAlerts();
    setShowAttachModal(true);
  };

  const runRealtimeInference = useCallback(async () => {
    if (isAnalyzingRef.current || !stream) return;
    if (document.visibilityState !== "visible") return;
    const video = videoRef.current;
    if (!video || video.paused || video.ended) return;
    
    try {
      isAnalyzingRef.current = true;
      
      if (!canvasRef.current) canvasRef.current = document.createElement("canvas");
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob(async (blob) => {
        if (!blob) {
          isAnalyzingRef.current = false;
          return;
        }
        
        try {
          const result = await analyzeImage(new File([blob], "frame.jpg", { type: "image/jpeg" }));
          setAnalysisResult(result);
        } catch (err) {
          console.error("Realtime inference error:", err);
        } finally {
          isAnalyzingRef.current = false;
        }
      }, "image/jpeg", 0.85);
    } catch (err) {
      console.error("Frame capture error:", err);
      isAnalyzingRef.current = false;
    }
  }, [stream]);

  const startRealtimeInference = useCallback(() => {
    if (!stream || intervalRef.current) return;
    setIsInferenceRunning(true);
    runRealtimeInference();
    intervalRef.current = setInterval(() => {
      runRealtimeInference();
    }, 1000);
  }, [stream, runRealtimeInference]);

  const stopRealtimeInference = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsInferenceRunning(false);
    isAnalyzingRef.current = false;
  }, []);

  useEffect(() => {
    if (stream && isRealTimeMode && !capturedImage) {
      startRealtimeInference();
    } else {
      stopRealtimeInference();
    }
    
    return () => {
      stopRealtimeInference();
    };
  }, [stream, isRealTimeMode, capturedImage, startRealtimeInference, stopRealtimeInference]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        stopRealtimeInference();
      } else if (stream && isRealTimeMode && !capturedImage) {
        startRealtimeInference();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [stream, isRealTimeMode, capturedImage, startRealtimeInference, stopRealtimeInference]);

  const handleAttachToAlert = async () => {
    if (!selectedAlertId || !capturedImage || !analysisResult) return;
    
    setIsAttaching(true);
    try {
      const token = await getToken();
      await attachEvidenceToAlert(selectedAlertId, capturedImage, analysisResult, token);
      setAttachSuccess(true);
      setTimeout(() => {
        setShowAttachModal(false);
        setAttachSuccess(false);
        setSelectedAlertId(null);
      }, 1500);
    } catch (err) {
      console.error("Failed to attach evidence:", err);
      setError("Gagal melampirkan bukti. Silakan coba lagi.");
    } finally {
      setIsAttaching(false);
    }
  };

  const isSecureContext = isClient && navigator?.mediaDevices?.getUserMedia;

  if (!isClient) return <div className="p-8 text-center text-slate-500">Memuat sistem kamera...</div>;

  if (!isSecureContext) {
    return (
      <div className="bg-rose-50/80 backdrop-blur-sm border border-rose-200 rounded-2xl p-8 text-center">
        <AlertCircle className="w-8 h-8 text-rose-600 mx-auto mb-3" />
        <h3 className="text-rose-800 font-semibold mb-2">Kamera Tidak Tersedia</h3>
        <p className="text-sm text-rose-600">Akses kamera memerlukan koneksi aman (HTTPS).</p>
      </div>
    );
  }

  // Dimensions for overlay
  const containerWidth = videoRef.current?.clientWidth || 800;
  const containerHeight = videoRef.current?.clientHeight || 600;
  const originalWidth = analysisResult?.image_width ?? videoRef.current?.videoWidth ?? 1280;
  const originalHeight = analysisResult?.image_height ?? videoRef.current?.videoHeight ?? 720;

  return (
    <div className="space-y-4">
      <div className="relative w-full bg-slate-950 rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/10 aspect-[4/3] md:aspect-video group">
        
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover transition-opacity duration-300 ${capturedImage ? 'opacity-0 absolute inset-0' : 'opacity-100'}`}
        />

        {capturedImage && (
            <div className="absolute inset-0 bg-slate-950">
                <img 
                    src={capturedImage} 
                    alt="Captured Evidence" 
                    className="w-full h-full object-cover"
                />
            </div>
        )}

        {analysisResult && analysisResult.bboxes.length > 0 && (
          <div className="absolute inset-0 pointer-events-none">
            <CVDetectionOverlay
                bboxes={analysisResult.bboxes}
                severity={analysisResult.severity}
                containerSize={{ width: containerWidth, height: containerHeight }}
                originalSize={{ width: originalWidth, height: originalHeight }}
            />
          </div>
        )}

        {isAnalyzing && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-20 animate-in fade-in duration-300">
                <div className="relative">
                    <div className="w-16 h-16 border-4 border-teal-500/30 border-t-teal-500 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-8 h-8 bg-teal-500 rounded-full animate-pulse"></div>
                    </div>
                </div>
                <p className="mt-4 text-white font-medium tracking-wide">Menganalisis Citra...</p>
            </div>
        )}

        {error && (
            <div className="absolute top-4 left-4 right-4 z-50">
                <div className="bg-rose-500/90 backdrop-blur text-white px-4 py-3 rounded-xl flex items-center gap-3 shadow-lg">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm font-medium">{error}</p>
                    <button onClick={() => setError("")} className="ml-auto p-1 hover:bg-white/20 rounded-lg">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>
        )}

        {!capturedImage && !isAnalyzing && (
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent flex flex-col items-center gap-6 pb-8 md:pb-10">
                
                {devices.length > 1 && (
                    <div className="relative group">
                        <select 
                            value={selectedDeviceId}
                            onChange={(e) => handleDeviceChange(e.target.value)}
                            className="appearance-none bg-black/40 backdrop-blur-md border border-white/20 text-white text-xs font-medium py-1.5 pl-3 pr-8 rounded-full focus:outline-none focus:ring-2 focus:ring-teal-500/50 cursor-pointer hover:bg-black/60 transition-colors"
                        >
                            {devices.map(d => (
                                <option key={d.deviceId} value={d.deviceId} className="text-black">
                                    {d.label || `Kamera ${d.deviceId.slice(0, 4)}...`}
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/70 pointer-events-none" />
                    </div>
                )}

                <button 
                    onClick={captureAndAnalyze}
                    disabled={isStarting || !stream}
                    className="group relative flex items-center justify-center"
                    aria-label="Ambil Bukti"
                >
                    <div className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-white/90 bg-transparent transition-transform duration-150 group-active:scale-95 shadow-[0_0_20px_rgba(0,0,0,0.3)]"></div>
                    <div className="absolute w-16 h-16 md:w-20 md:h-20 bg-white rounded-full transition-all duration-150 group-active:scale-90 group-hover:bg-teal-50 group-active:bg-teal-100 shadow-inner"></div>
                </button>
                
                <p className="text-white/80 text-sm font-medium drop-shadow-md">AMBIL BUKTI</p>
            </div>
        )}

        {!capturedImage && (
            <div className="absolute top-4 left-4 bg-black/30 backdrop-blur px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full animate-pulse ${isInferenceRunning ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                <span className="text-xs font-medium text-white tracking-wide uppercase">
                    {isInferenceRunning ? 'Analisis Aktif' : 'Live Camera'}
                </span>
            </div>
        )}

        {!capturedImage && (
            <div className="absolute top-4 right-4 flex items-center gap-2">
                <button
                    onClick={() => setIsRealTimeMode(!isRealTimeMode)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur border transition-all ${
                        isRealTimeMode 
                            ? 'bg-teal-500/80 border-teal-400/50 text-white' 
                            : 'bg-black/30 border-white/10 text-white/70 hover:bg-black/50'
                    }`}
                >
                    {isRealTimeMode ? <Zap className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                    <span className="text-xs font-medium">{isRealTimeMode ? 'Real-time ON' : 'Real-time OFF'}</span>
                </button>
            </div>
        )}
      </div>

      {capturedImage && (
        <div className="animate-in slide-in-from-bottom-4 duration-500">
             <GlassCard className={`p-0 overflow-hidden border-0 ${analysisResult?.detected ? 'bg-amber-50/90 ring-1 ring-amber-200' : 'bg-emerald-50/90 ring-1 ring-emerald-200'}`}>
                
                {/* Header */}
                <div className={`px-6 py-4 flex items-center gap-3 border-b ${analysisResult?.detected ? 'border-amber-200/50' : 'border-emerald-200/50'}`}>
                    {analysisResult?.detected ? (
                        <div className="p-2 bg-amber-100 text-amber-600 rounded-full">
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                    ) : (
                        <div className="p-2 bg-emerald-100 text-emerald-600 rounded-full">
                            <CheckCircle2 className="w-6 h-6" />
                        </div>
                    )}
                    <div>
                        <h2 className={`text-xl font-bold ${analysisResult?.detected ? 'text-amber-900' : 'text-emerald-900'}`}>
                            {analysisResult?.detected ? "WASPADA: Kontaminan Terdeteksi" : "Kondisi Aman"}
                        </h2>
                        <p className={`text-sm ${analysisResult?.detected ? 'text-amber-700' : 'text-emerald-700'}`}>
                           {analysisResult?.detected ? "Indikasi Acid Mine Drainage (AMD) aktif" : "Tidak ditemukan indikasi visual kontaminasi"}
                        </p>
                    </div>
                </div>

                {/* Details Body */}
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Keyakinan (Confidence)</span>
                            <div className="flex items-end gap-2">
                                <span className="text-3xl font-bold text-slate-800">
                                    {(analysisResult?.confidence ? analysisResult.confidence * 100 : 0).toFixed(1)}%
                                </span>
                                <div className="h-2 flex-1 bg-slate-200 rounded-full mb-2 overflow-hidden">
                                    <div 
                                        className={`h-full rounded-full ${analysisResult?.detected ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                                        style={{ width: `${(analysisResult?.confidence || 0) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>

                        {analysisResult?.detected && (
                            <div className="space-y-1">
                                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Interpretasi Visual</span>
                                <p className="text-slate-700 leading-relaxed">
                                    Terdeteksi <span className="font-semibold text-amber-700">presipitasi besi hidroksida (Yellow Boy)</span> pada {analysisResult?.bboxes.length} lokasi dalam frame. Tekstur dan warna sesuai dengan signature oksidasi pirit.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col justify-center gap-3">
                         <button 
                            onClick={handleOpenAttachModal}
                            className="w-full py-3.5 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-semibold shadow-md shadow-teal-900/10 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                          >
                            <Paperclip className="w-5 h-5" />
                            Lampirkan ke Peringatan
                        </button>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <button className="py-3 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors">
                                <Save className="w-5 h-5" />
                                Simpan
                            </button>
                            <button 
                                onClick={handleRetake}
                                className="py-3 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
                            >
                                <Repeat className="w-5 h-5" />
                                Ambil Ulang
                            </button>
                        </div>
                    </div>
                </div>
             </GlassCard>
        </div>
      )}

      {showAttachModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Lampirkan ke Peringatan</h3>
                <p className="text-sm text-slate-500">Pilih peringatan aktif untuk melampirkan bukti ini</p>
              </div>
              <button 
                onClick={() => setShowAttachModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {isLoadingAlerts ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <RefreshCw className="w-8 h-8 text-teal-500 animate-spin mb-3" />
                  <p className="text-slate-500">Memuat daftar peringatan...</p>
                </div>
              ) : alerts.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600 font-medium">Tidak ada peringatan aktif</p>
                  <p className="text-sm text-slate-400 mt-1">Buat peringatan baru di menu Peringatan</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {alerts.map((alert) => (
                    <button
                      key={alert.id}
                      onClick={() => setSelectedAlertId(alert.id)}
                      className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                        selectedAlertId === alert.id 
                          ? 'border-teal-500 bg-teal-50' 
                          : 'border-slate-200 hover:border-teal-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-3 h-3 rounded-full mt-1.5 flex-shrink-0 ${
                          alert.severity === 'critical' ? 'bg-rose-500' :
                          alert.severity === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-800 truncate">
                            {alert.message || `Peringatan Sensor #${alert.sensor_id}`}
                          </p>
                          <p className="text-sm text-slate-500">
                            {new Date(alert.created_at).toLocaleString('id-ID')}
                          </p>
                        </div>
                        {selectedAlertId === alert.id && (
                          <CheckCircle2 className="w-5 h-5 text-teal-500 flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200">
              {attachSuccess ? (
                <div className="flex items-center justify-center gap-2 py-2 text-emerald-600">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-semibold">Bukti berhasil dilampirkan!</span>
                </div>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowAttachModal(false)}
                    className="flex-1 py-2.5 px-4 border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleAttachToAlert}
                    disabled={!selectedAlertId || isAttaching}
                    className="flex-1 py-2.5 px-4 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {isAttaching ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Menyimpan...
                      </>
                    ) : (
                      <>
                        <Paperclip className="w-4 h-4" />
                        Lampirkan
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
