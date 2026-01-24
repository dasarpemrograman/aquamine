import Link from "next/link";
import SensorStatus from "./components/SensorStatus";
import AlertList from "./components/AlertList";

export default function Home() {
  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col items-center p-8 text-center bg-zinc-50 dark:bg-black">
      <div className="max-w-7xl w-full space-y-12">
        <div className="max-w-2xl mx-auto space-y-8">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
            AquaMine <span className="text-blue-600 dark:text-blue-400">AI</span>
          </h1>
          
          <p className="text-xl text-zinc-600 dark:text-zinc-400">
            Advanced monitoring and early warning system for Acid Mine Drainage (AMD).
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 text-left">
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

          <div className="contents md:block lg:contents">
             <div className="md:col-span-1">
                <SensorStatus />
             </div>
             <div className="md:col-span-1">
                <AlertList />
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
