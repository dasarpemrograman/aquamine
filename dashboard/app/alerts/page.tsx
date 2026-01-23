import AlertList from "../components/AlertList";

export default function AlertsPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">System Alerts</h1>
      <AlertList />
    </div>
  );
}
