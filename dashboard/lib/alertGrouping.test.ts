import { describe, it, expect } from 'vitest';
import { groupAlerts } from './alertGrouping';
import { Alert } from './api';

describe('groupAlerts', () => {
  const baseAlert: Alert = {
    id: 1,
    sensor_id: 101,
    severity: 'critical',
    previous_state: 'normal',
    message: 'PH critical: 1.50',
    created_at: new Date().toISOString(),
    acknowledged_at: null,
    acknowledged_by: null,
    resolved_at: null,
    resolved_by: null,
    resolution_note: null,
    reopened_at: null,
    reopened_by: null
  };

  it('should return empty array for no alerts', () => {
    expect(groupAlerts([])).toEqual([]);
  });

  it('should group identical alerts within window', () => {
    const now = new Date();
    const alert1: Alert = {
      ...baseAlert,
      id: 1,
      created_at: now.toISOString()
    };
    const alert2: Alert = {
      ...baseAlert,
      id: 2,
      created_at: new Date(now.getTime() - 1000 * 60 * 5).toISOString()
    };

    const grouped = groupAlerts([alert1, alert2]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].count).toBe(2);
    expect(grouped[0].id).toBe(1);
    expect(grouped[0].childAlerts).toHaveLength(1);
    expect(grouped[0].childAlerts[0].id).toBe(2);
  });

  it('should NOT group alerts outside window', () => {
    const now = new Date();
    const alert1: Alert = {
      ...baseAlert,
      id: 1,
      created_at: now.toISOString()
    };
    const alert2: Alert = {
      ...baseAlert,
      id: 2,
      created_at: new Date(now.getTime() - 1000 * 60 * 40).toISOString()
    };

    const grouped = groupAlerts([alert1, alert2]);
    expect(grouped).toHaveLength(2);
  });

  it('should NOT group alerts with different sensor_id', () => {
    const now = new Date();
    const alert1: Alert = {
      ...baseAlert,
      id: 1,
      sensor_id: 101
    };
    const alert2: Alert = {
      ...baseAlert,
      id: 2,
      sensor_id: 102
    };

    const grouped = groupAlerts([alert1, alert2]);
    expect(grouped).toHaveLength(2);
  });

  it('should group recovery messages together', () => {
    const now = new Date();
    const alert1: Alert = {
      ...baseAlert,
      id: 1,
      message: 'Sensor recovered to normal state',
      severity: 'info'
    };
    const alert2: Alert = {
      ...baseAlert,
      id: 2,
      message: 'System normal',
      severity: 'info',
      created_at: new Date(now.getTime() - 1000 * 60 * 5).toISOString()
    };

    const grouped = groupAlerts([alert1, alert2]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].count).toBe(2);
  });

  it('should differentiate between different parameters', () => {
    const now = new Date();
    const alert1: Alert = {
      ...baseAlert,
      id: 1,
      message: 'PH critical: 1.50'
    };
    const alert2: Alert = {
      ...baseAlert,
      id: 2,
      message: 'TURBIDITY critical: 120.00'
    };

    const grouped = groupAlerts([alert1, alert2]);
    expect(grouped).toHaveLength(2);
  });
});
