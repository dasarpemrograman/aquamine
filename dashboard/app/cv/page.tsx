"use client";

import { useEffect, useRef, useState } from "react";
import ImageUploader from "../components/ImageUploader";
import LiveCameraView from "../components/LiveCameraView";
import VideoFileView from "../components/VideoFileView";
import { Camera, Film, Image as ImageIcon, CheckCircle2 } from "lucide-react";

type Mode = "live" | "video" | "image";

export default function CVAnalysisPage() {
  const [mode, setMode] = useState<Mode>("live");

  const liveStreamRef = useRef<MediaStream | null>(null);
  const videoObjectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (mode === "live" && liveStreamRef.current) {
        liveStreamRef.current.getTracks().forEach((t) => t.stop());
        liveStreamRef.current = null;
      }

      if (mode === "video" && videoObjectUrlRef.current) {
        URL.revokeObjectURL(videoObjectUrlRef.current);
        videoObjectUrlRef.current = null;
      }
    };
  }, [mode]);

  return (
    <div className="space-y-8 pb-20">
      <div className="relative py-12 px-6 rounded-3xl overflow-hidden bg-surface border border-white/5 shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-transparent opacity-50" />
        <div className="absolute right-0 top-0 w-96 h-96 bg-primary/20 rounded-full blur-3xl -mr-32 -mt-32" />
        
        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-full border border-primary/20 bg-primary/10 text-primary text-sm font-bold mb-4 shadow-lg shadow-primary/20">
            <span className="relative flex h-2 w-2 mr-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Computer Vision System v1.0
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
            Visual Analysis
          </h1>
          
          <p className="text-lg text-foreground-muted max-w-2xl mx-auto leading-relaxed">
            Upload site imagery to detect <span className="text-primary font-bold">Yellow Boy</span> precipitates. 
            Our model analyzes color signatures and texture patterns to assess contamination severity in real-time.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4">
        <div className="mb-8 flex justify-center">
          <div className="inline-flex p-1 bg-surface border border-white/5 rounded-xl shadow-lg">
            <button
              onClick={() => setMode("live")}
              className={`px-6 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${
                mode === "live"
                  ? "bg-primary text-background shadow-md shadow-primary/20"
                  : "text-foreground-muted hover:text-foreground hover:bg-white/5"
              }`}
            >
              <Camera size={18} /> Live Camera
            </button>
            <button
              onClick={() => setMode("video")}
              className={`px-6 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${
                mode === "video"
                   ? "bg-primary text-background shadow-md shadow-primary/20"
                  : "text-foreground-muted hover:text-foreground hover:bg-white/5"
              }`}
            >
              <Film size={18} /> Video File
            </button>
            <button
              onClick={() => setMode("image")}
              className={`px-6 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${
                mode === "image"
                   ? "bg-primary text-background shadow-md shadow-primary/20"
                  : "text-foreground-muted hover:text-foreground hover:bg-white/5"
              }`}
            >
              <ImageIcon size={18} /> Image Upload
            </button>
          </div>
        </div>

        <div className="bg-surface border border-white/5 rounded-2xl shadow-xl overflow-hidden min-h-[500px] flex flex-col p-1">
           {mode === "live" && (
             <LiveCameraView onStreamReady={(s) => (liveStreamRef.current = s)} />
           )}
           {mode === "video" && (
             <VideoFileView
               onVideoUrlChange={(url) => {
                 videoObjectUrlRef.current = url;
               }}
             />
           )}
           {mode === "image" && <ImageUploader />}
        </div>
        
        <div className="mt-12 pt-8 border-t border-white/5 flex flex-col items-center justify-center gap-2 text-foreground-muted">
          <p className="text-xs font-bold uppercase tracking-widest text-primary/50">
            Powered by YOLOv8
          </p>
          <div className="flex items-center gap-6 text-sm">
            <span className="flex items-center gap-2"><CheckCircle2 size={14} className="text-success" /> Inference Time &lt;100ms</span>
            <span className="flex items-center gap-2"><CheckCircle2 size={14} className="text-success" /> Accuracy 94%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
