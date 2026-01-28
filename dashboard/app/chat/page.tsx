import ChatInterface from "../components/ChatInterface";

export default function ChatPage() {
  return (
    <div className="min-h-[calc(100vh-64px)] px-6 py-10 flex items-center justify-center">
      <div className="w-full max-w-4xl flex flex-col gap-6 rounded-2xl bg-gradient-to-br from-blue-600/30 via-blue-400/10 to-blue-900/20 p-8 shadow-lg border border-white/10">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            AquaMine AI Assistant
          </h1>
          <p className="text-sm text-foreground-muted">
            Ask about sensors, anomalies, or remediation options.
          </p>
        </div>
        <div className="min-h-[520px]">
          <ChatInterface />
        </div>
      </div>
    </div>
  );
}
