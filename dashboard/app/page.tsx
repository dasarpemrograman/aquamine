import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center p-8 text-center bg-zinc-50 dark:bg-black">
      <div className="max-w-2xl space-y-8">
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
          AquaMine <span className="text-blue-600 dark:text-blue-400">AI</span>
        </h1>
        
        <p className="text-xl text-zinc-600 dark:text-zinc-400">
          Advanced monitoring and early warning system for Acid Mine Drainage (AMD).
        </p>

        <div className="grid gap-4 md:grid-cols-2 mt-12">
          <Link 
            href="/cv"
            className="group block p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:border-blue-500 dark:hover:border-blue-500 transition-all duration-200 hover:shadow-lg"
          >
            <h3 className="text-lg font-bold mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400">
              Visual Analysis &rarr;
            </h3>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">
              Upload water source images to detect and analyze Yellow Boy precipitates using Computer Vision.
            </p>
          </Link>

          <div className="p-6 bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl opacity-75 cursor-not-allowed">
            <h3 className="text-lg font-bold mb-2 text-zinc-500">
              Live Telemetry (Coming Soon)
            </h3>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">
              Real-time IoT sensor data monitoring for pH, turbidity, and flow rate.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
