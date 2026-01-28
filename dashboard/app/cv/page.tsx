"use client";

import { useEffect, useRef, useState } from "react";
import ImageUploader from "../components/ImageUploader";
import LiveCameraView from "../components/LiveCameraView";
import VideoFileView from "../components/VideoFileView";
import { GlassPanel } from "@/app/components/ui/GlassPanel";
import { SectionHeader } from "@/app/components/ui/SectionHeader";
import { Camera, Video, Image as ImageIcon, Sparkles } from "lucide-react";

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
    <div className="min-h-screen px-6 py-8 md:px-8 md:py-10 selection:bg-teal-500/30">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <SectionHeader
          title="Visual Analysis"
          subtitle="Advanced detection of Yellow Boy precipitates using texture analysis and color signature profiling"
          icon={Camera}
          actions={
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-teal-200/50 bg-white/40 backdrop-blur-md shadow-sm text-teal-800 text-xs font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
              </span>
              Computer Vision System v1.0
            </div>
          }
        />

        <div className="flex justify-start">
          <div className="inline-flex p-1.5 bg-white/40 backdrop-blur-xl border border-white/50 rounded-2xl shadow-lg ring-1 ring-black/5">
            <button
              onClick={() => setMode("live")}
              className={`flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
                mode === "live"
                  ? "bg-gradient-to-tr from-teal-500 to-cyan-500 text-white shadow-md"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              }`}
            >
              <Camera className="w-4 h-4" />
              Live Camera
            </button>
            <button
              onClick={() => setMode("video")}
              className={`flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
                mode === "video"
                  ? "bg-gradient-to-tr from-teal-500 to-cyan-500 text-white shadow-md"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              }`}
            >
              <Video className="w-4 h-4" />
              Video File
            </button>
            <button
              onClick={() => setMode("image")}
              className={`flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
                mode === "image"
                  ? "bg-gradient-to-tr from-teal-500 to-cyan-500 text-white shadow-md"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              Image Upload
            </button>
          </div>
        </div>

        <div className="relative min-h-[600px] transition-all duration-500 ease-in-out">
          <GlassPanel className="min-h-[600px] bg-white/40 backdrop-blur-xl border-white/60 shadow-xl shadow-teal-900/5">
            <div className="h-full">
              {mode === "live" && (
                <div className="animate-in fade-in zoom-in-95 duration-500">
                  <div className="flex items-center gap-3 mb-6 px-2">
                    <div className="p-2 bg-teal-100/50 rounded-lg text-teal-700">
                      <Camera className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800">Real-time Inference</h3>
                      <p className="text-sm text-slate-500">Connect a camera to detect contaminants in real-time</p>
                    </div>
                  </div>
                  <LiveCameraView onStreamReady={(s) => (liveStreamRef.current = s)} />
                </div>
              )}
              
              {mode === "video" && (
                <div className="animate-in fade-in zoom-in-95 duration-500">
                  <div className="flex items-center gap-3 mb-6 px-2">
                    <div className="p-2 bg-teal-100/50 rounded-lg text-teal-700">
                      <Video className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800">Video Analysis</h3>
                      <p className="text-sm text-slate-500">Process recorded footage for detailed inspection</p>
                    </div>
                  </div>
                  <VideoFileView
                    onVideoUrlChange={(url) => {
                      videoObjectUrlRef.current = url;
                    }}
                  />
                </div>
              )}
              
              {mode === "image" && (
                <div className="animate-in fade-in zoom-in-95 duration-500">
                  <div className="flex items-center gap-3 mb-6 px-2">
                    <div className="p-2 bg-teal-100/50 rounded-lg text-teal-700">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800">Static Analysis</h3>
                      <p className="text-sm text-slate-500">High-resolution analysis of single capture frames</p>
                    </div>
                  </div>
                  <ImageUploader />
                </div>
              )}
            </div>
          </GlassPanel>
        </div>
        
        <div className="mt-2 text-center flex items-center justify-center gap-2 text-xs font-medium text-slate-400 uppercase tracking-widest opacity-60">
          <Sparkles className="w-3 h-3" />
          Powered by YOLOv8 • Inference Time &lt;100ms • Accuracy 94%
        </div>
      </div>
    </div>
  );
}
