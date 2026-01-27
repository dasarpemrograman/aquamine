import ChatInterface from "../components/ChatInterface";

export default function ChatPage() {
  return (
    <div className="min-h-[calc(100vh-64px)] bg-white px-6 py-10">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 md:text-4xl">
            AquaMine AI Assistant
          </h1>
          <p className="text-sm text-zinc-500">
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
