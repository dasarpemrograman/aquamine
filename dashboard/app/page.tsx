import Link from "next/link";
import SensorStatus from "./components/SensorStatus";
import AlertList from "./components/AlertList";
import { Camera, ArrowRight, Activity, Droplets } from "lucide-react";

export default function Home() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Overview
          </h1>
          <p className="text-foreground-muted mt-1">
            Real-time monitoring of water quality and sensor network status.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-surface hover:bg-white/5 text-foreground font-medium rounded-xl border border-white/10 transition-colors">
            Export Report
          </button>
          <button className="px-4 py-2 bg-primary hover:bg-primary-glow text-background font-bold rounded-xl transition-all shadow-lg shadow-primary/20">
            System Check
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link 
          href="/cv"
          className="group relative md:col-span-2 bg-gradient-to-br from-surface to-[#1e293b] p-8 rounded-2xl border border-white/5 overflow-hidden hover:border-primary/50 transition-all duration-300"
        >
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div className="flex items-start justify-between">
              <div className="p-3 bg-white/5 rounded-xl backdrop-blur-sm group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                <Camera className="w-8 h-8" />
              </div>
              <ArrowRight className="w-6 h-6 text-foreground-muted group-hover:translate-x-1 group-hover:text-primary transition-all" />
            </div>
            
            <div className="mt-8">
              <h3 className="text-2xl font-bold text-foreground mb-2">Visual Analysis</h3>
              <p className="text-foreground-muted max-w-md">
                Upload water source images to detect "Yellow Boy" precipitates using advanced Computer Vision models.
              </p>
            </div>
          </div>
          
          <div className="absolute right-0 top-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-primary/10 transition-all" />
        </Link>

        <div className="bg-surface p-8 rounded-2xl border border-white/5 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
             <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl">
                <Activity className="w-8 h-8" />
             </div>
             <span className="text-xs font-bold uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded">
                Good
             </span>
          </div>
          <div>
             <span className="text-4xl font-bold text-foreground">98%</span>
             <p className="text-foreground-muted mt-1">System Health Score</p>
          </div>
           <div className="absolute right-0 bottom-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -mr-8 -mb-8" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-full">
          <SensorStatus />
        </div>
        <div className="lg:col-span-1 h-full">
          <AlertList />
        </div>
      </div>
    </div>
  );
}
