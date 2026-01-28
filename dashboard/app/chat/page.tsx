import ChatInterface from "../components/ChatInterface";
import { SectionHeader } from "@/app/components/ui/SectionHeader";
import { MessageSquare } from "lucide-react";

export default function ChatPage() {
  return (
    <div className="min-h-screen px-6 py-8 md:px-8 md:py-10">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <SectionHeader
          title="AI Assistant"
          subtitle="Ask about anomalies, forecasts, or remediation steps"
          icon={MessageSquare}
        />
        <div className="h-[calc(100vh-240px)] min-h-[520px]">
          <ChatInterface />
        </div>
      </div>
    </div>
  );
}
