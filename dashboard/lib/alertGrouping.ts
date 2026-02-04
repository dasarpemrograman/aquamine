import { Alert } from "./api";

export interface GroupedAlert extends Alert {
  count: number;
  childAlerts: Alert[];
  isGroupHeader: boolean;
}

/**
 * Extracts a grouping key from an alert message.
 * Matches "PARAMETER severity:" pattern or treats recovery messages as a single type.
 */
function getAlertKey(message: string | null): string {
  if (!message) return "unknown";
  
  const match = message.match(/^([A-Z]+)\s+(critical|warning|info):/i);
  if (match) {
    return `${match[1].toUpperCase()} ${match[2].toLowerCase()}`;
  }
  
  if (message.toLowerCase().includes("recovered") || message.toLowerCase().includes("normal")) {
    return "RECOVERY";
  }

  return message;
}

export function groupAlerts(alerts: Alert[], windowMinutes: number = 30): GroupedAlert[] {
  if (!alerts.length) return [];

  const sortedAlerts = [...alerts].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const groups: GroupedAlert[] = [];

  for (const alert of sortedAlerts) {
    const alertTime = new Date(alert.created_at).getTime();
    const alertKey = getAlertKey(alert.message);
    
    const matchingGroupIndex = groups.findIndex(group => {
      const groupTime = new Date(group.created_at).getTime();
      const timeDiffMinutes = Math.abs(groupTime - alertTime) / (1000 * 60);
      
      const groupKey = getAlertKey(group.message);
      
      return (
        group.sensor_id === alert.sensor_id &&
        groupKey === alertKey &&
        timeDiffMinutes <= windowMinutes
      );
    });

    if (matchingGroupIndex !== -1) {
      groups[matchingGroupIndex].childAlerts.push(alert);
      groups[matchingGroupIndex].count++;
    } else {
      groups.push({
        ...alert,
        count: 1,
        childAlerts: [],
        isGroupHeader: true
      });
    }
  }

  return groups;
}
