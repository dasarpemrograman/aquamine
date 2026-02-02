import { describe, it, expect } from "vitest";
import {
  getMarkerColor,
  getPolygonColor,
  countMissingCoords,
  SEVERITY_COLORS,
  SensorWithState,
  BERKELEY_PIT_POLYGON,
} from "../app/components/map/mapUtils";

describe("getMarkerColor", () => {
  it("returns offline color when sensor is not active", () => {
    const sensor: SensorWithState = {
      id: 1,
      sensor_id: "S1",
      name: "Sensor 1",
      is_active: false,
      current_state: "normal",
    };
    expect(getMarkerColor(sensor)).toBe(SEVERITY_COLORS.offline);
  });

  it("returns normal color for normal state", () => {
    const sensor: SensorWithState = {
      id: 1,
      sensor_id: "S1",
      name: "Sensor 1",
      is_active: true,
      current_state: "normal",
    };
    expect(getMarkerColor(sensor)).toBe(SEVERITY_COLORS.normal);
  });

  it("returns warning color for warning state", () => {
    const sensor: SensorWithState = {
      id: 1,
      sensor_id: "S1",
      name: "Sensor 1",
      is_active: true,
      current_state: "warning",
    };
    expect(getMarkerColor(sensor)).toBe(SEVERITY_COLORS.warning);
  });

  it("returns critical color for critical state", () => {
    const sensor: SensorWithState = {
      id: 1,
      sensor_id: "S1",
      name: "Sensor 1",
      is_active: true,
      current_state: "critical",
    };
    expect(getMarkerColor(sensor)).toBe(SEVERITY_COLORS.critical);
  });

  it("returns unknown color for null state", () => {
    const sensor: SensorWithState = {
      id: 1,
      sensor_id: "S1",
      name: "Sensor 1",
      is_active: true,
      current_state: null,
    };
    expect(getMarkerColor(sensor)).toBe(SEVERITY_COLORS.unknown);
  });

  it("returns unknown color for undefined state", () => {
    const sensor: SensorWithState = {
      id: 1,
      sensor_id: "S1",
      name: "Sensor 1",
      is_active: true,
    };
    expect(getMarkerColor(sensor)).toBe(SEVERITY_COLORS.unknown);
  });

  it("is case insensitive", () => {
    const sensor: SensorWithState = {
      id: 1,
      sensor_id: "S1",
      name: "Sensor 1",
      is_active: true,
      current_state: "WARNING",
    };
    expect(getMarkerColor(sensor)).toBe(SEVERITY_COLORS.warning);
  });
});

describe("getPolygonColor", () => {
  const sensorInsidePolygon: SensorWithState = {
    id: 1,
    sensor_id: "S1",
    name: "Inside Sensor",
    latitude: 46.02,
    longitude: -112.51,
    is_active: true,
    current_state: "normal",
  };

  const sensorOutsidePolygon: SensorWithState = {
    id: 2,
    sensor_id: "S2",
    name: "Outside Sensor",
    latitude: 46.05,
    longitude: -112.55,
    is_active: true,
    current_state: "critical",
  };

  it("returns gray when no sensors are in polygon", () => {
    const sensors: SensorWithState[] = [];
    expect(getPolygonColor(sensors)).toBe(SEVERITY_COLORS.unknown);
  });

  it("returns gray when only offline sensors are in polygon", () => {
    const sensors: SensorWithState[] = [
      { ...sensorInsidePolygon, is_active: false, current_state: "critical" },
    ];
    expect(getPolygonColor(sensors)).toBe(SEVERITY_COLORS.unknown);
  });

  it("returns normal color when only normal sensors are in polygon", () => {
    const sensors: SensorWithState[] = [
      { ...sensorInsidePolygon, current_state: "normal" },
      { ...sensorInsidePolygon, id: 2, sensor_id: "S2", current_state: "normal" },
    ];
    expect(getPolygonColor(sensors)).toBe(SEVERITY_COLORS.normal);
  });

  it("returns warning color when warning sensor is in polygon", () => {
    const sensors: SensorWithState[] = [
      { ...sensorInsidePolygon, current_state: "normal" },
      { ...sensorInsidePolygon, id: 2, sensor_id: "S2", current_state: "warning" },
    ];
    expect(getPolygonColor(sensors)).toBe(SEVERITY_COLORS.warning);
  });

  it("returns critical color when critical sensor is in polygon", () => {
    const sensors: SensorWithState[] = [
      { ...sensorInsidePolygon, current_state: "normal" },
      { ...sensorInsidePolygon, id: 2, sensor_id: "S2", current_state: "warning" },
      { ...sensorInsidePolygon, id: 3, sensor_id: "S3", current_state: "critical" },
    ];
    expect(getPolygonColor(sensors)).toBe(SEVERITY_COLORS.critical);
  });

  it("ignores sensors outside polygon", () => {
    const sensors: SensorWithState[] = [
      { ...sensorInsidePolygon, current_state: "normal" },
      { ...sensorOutsidePolygon, current_state: "critical" },
    ];
    expect(getPolygonColor(sensors)).toBe(SEVERITY_COLORS.normal);
  });

  it("ignores sensors without coordinates", () => {
    const sensors: SensorWithState[] = [
      { ...sensorInsidePolygon, current_state: "normal" },
      { ...sensorInsidePolygon, id: 2, sensor_id: "S2", latitude: null, longitude: null, current_state: "critical" },
    ];
    expect(getPolygonColor(sensors)).toBe(SEVERITY_COLORS.normal);
  });

  it("follows priority: critical > warning > normal", () => {
    const sensors: SensorWithState[] = [
      { ...sensorInsidePolygon, id: 1, current_state: "normal" },
      { ...sensorInsidePolygon, id: 2, sensor_id: "S2", current_state: "critical" },
      { ...sensorInsidePolygon, id: 3, sensor_id: "S3", current_state: "warning" },
    ];
    expect(getPolygonColor(sensors)).toBe(SEVERITY_COLORS.critical);
  });
});

describe("countMissingCoords", () => {
  it("returns 0 when all sensors have coordinates", () => {
    const sensors: SensorWithState[] = [
      { id: 1, sensor_id: "S1", name: "S1", latitude: 46.02, longitude: -112.51, is_active: true },
      { id: 2, sensor_id: "S2", name: "S2", latitude: 46.03, longitude: -112.52, is_active: true },
    ];
    expect(countMissingCoords(sensors)).toBe(0);
  });

  it("returns count of sensors without coordinates", () => {
    const sensors: SensorWithState[] = [
      { id: 1, sensor_id: "S1", name: "S1", latitude: null, longitude: -112.51, is_active: true },
      { id: 2, sensor_id: "S2", name: "S2", latitude: 46.03, longitude: null, is_active: true },
      { id: 3, sensor_id: "S3", name: "S3", is_active: true },
      { id: 4, sensor_id: "S4", name: "S4", latitude: 46.04, longitude: -112.53, is_active: true },
    ];
    expect(countMissingCoords(sensors)).toBe(3);
  });

  it("returns 0 for empty array", () => {
    expect(countMissingCoords([])).toBe(0);
  });
});
