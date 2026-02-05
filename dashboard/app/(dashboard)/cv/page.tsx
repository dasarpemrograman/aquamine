"use client";

import { useEffect, useRef, useState } from "react";
import ImageUploader from "@/app/components/ImageUploader";
import LiveCameraView from "@/app/components/LiveCameraView";
import VideoFileView from "@/app/components/VideoFileView";
import { GlassPanel } from "@/app/components/ui/GlassPanel";
import { SectionHeader } from "@/app/components/ui/SectionHeader";
import { Camera, Video, Image as ImageIcon } from "lucide-react";
import { useFieldMode } from "@/app/context/FieldModeContext";

type Mode = "live" | "video" | "image";

export default function CVAnalysisPage() {
  const [mode, setMode] = useState<Mode>("live");
  const { isFieldMode } = useFieldMode();

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
    <div className="min-h-screen px-4 py-6 md:px-8 md:py-10 selection:bg-teal-500/30">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <SectionHeader
          title="Analisis Visual"
          subtitle="Deteksi presipitat Yellow Boy menggunakan analisis tekstur dan profil warna"
          icon={Camera}
          actions={
            <div className="hidden md:inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-teal-200/50 bg-white/40 backdrop-blur-md shadow-sm text-teal-800 text-xs font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
              </span>
              Sistem CV Aktif
            </div>
          }
        />

        <div className={isFieldMode ? "flex justify-stretch w-full" : "flex justify-start"}>
          <div className={`inline-flex p-1 bg-white/40 backdrop-blur-xl border border-white/50 rounded-xl shadow-sm ring-1 ring-black/5 ${isFieldMode ? "w-full grid grid-cols-3 gap-1" : ""}`}>
            <button
              onClick={() => setMode("live")}
              className={`flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-300 ${
                isFieldMode ? "px-2 py-3 text-sm flex-col" : "px-4 py-2 text-sm"
              } ${
                mode === "live"
                  ? "bg-white text-teal-700 shadow-sm ring-1 ring-black/5"
                  : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
              }`}
            >
              <Camera className={isFieldMode ? "w-5 h-5" : "w-4 h-4"} />
              {isFieldMode ? "Kamera" : "Kamera Langsung"}
            </button>
            <button
              onClick={() => setMode("video")}
              className={`flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-300 ${
                isFieldMode ? "px-2 py-3 text-sm flex-col" : "px-4 py-2 text-sm"
              } ${
                mode === "video"
                   ? "bg-white text-teal-700 shadow-sm ring-1 ring-black/5"
                  : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
              }`}
            >
              <Video className={isFieldMode ? "w-5 h-5" : "w-4 h-4"} />
              {isFieldMode ? "Video" : "File Video"}
            </button>
            <button
              onClick={() => setMode("image")}
              className={`flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-300 ${
                isFieldMode ? "px-2 py-3 text-sm flex-col" : "px-4 py-2 text-sm"
              } ${
                mode === "image"
                   ? "bg-white text-teal-700 shadow-sm ring-1 ring-black/5"
                  : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
              }`}
            >
              <ImageIcon className={isFieldMode ? "w-5 h-5" : "w-4 h-4"} />
              {isFieldMode ? "Foto" : "Unggah Foto"}
            </button>
          </div>
        </div>

        <div className="relative min-h-[500px] transition-all duration-500 ease-in-out">
          <GlassPanel className="min-h-[500px] bg-white/60 backdrop-blur-xl border-white/60 shadow-xl shadow-teal-900/5 p-4 md:p-6">
            <div className="h-full">
              {mode === "live" && (
                <div className="animate-in fade-in zoom-in-95 duration-500 h-full">
                  <div className="mb-4 hidden md:block">
                     <h3 className="text-lg font-semibold text-slate-800">Deteksi Real-time</h3>
                     <p className="text-sm text-slate-500">Arahkan kamera ke area genangan air tambang untuk analisis otomatis</p>
                  </div>
                  <LiveCameraView onStreamReady={(s) => (liveStreamRef.current = s)} />
                </div>
              )}
              
              {mode === "video" && (
                <div className="animate-in fade-in zoom-in-95 duration-500">
                   <div className="mb-4 hidden md:block">
                      <h3 className="text-lg font-semibold text-slate-800">Analisis Video</h3>
                      <p className="text-sm text-slate-500">Proses rekaman video untuk inspeksi mendetail</p>
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
                   <div className="mb-4 hidden md:block">
                      <h3 className="text-lg font-semibold text-slate-800">Analisis Statis</h3>
                      <p className="text-sm text-slate-500">Analisis resolusi tinggi dari file gambar</p>
                   </div>
                  <ImageUploader />
                </div>
              )}
            </div>
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}
