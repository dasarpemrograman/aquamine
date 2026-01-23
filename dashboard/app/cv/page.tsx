import ImageUploader from "../components/ImageUploader";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Yellow Boy Detection | AquaMine",
  description: "Analyze Acid Mine Drainage images for iron hydroxide precipitates",
};

export default function CVAnalysisPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-4 text-zinc-900 dark:text-zinc-50">
          Yellow Boy Detection
        </h1>
        <p className="text-center text-zinc-600 dark:text-zinc-400 mb-12 max-w-2xl mx-auto">
          Upload an image of a water source to detect the presence and severity of &quot;Yellow Boy&quot; 
          (iron hydroxide precipitate), a key indicator of Acid Mine Drainage.
        </p>
        <ImageUploader />
      </div>
    </div>
  );
}
