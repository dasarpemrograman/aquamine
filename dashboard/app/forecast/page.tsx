import ForecastChart from "../components/ForecastChart";

export default function ForecastPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Water Quality Forecast</h1>
      <div className="grid gap-8">
        <ForecastChart sensorId={1} parameter="ph" />
        <ForecastChart sensorId={1} parameter="turbidity" />
        <ForecastChart sensorId={1} parameter="temperature" />
      </div>
    </div>
  );
}
