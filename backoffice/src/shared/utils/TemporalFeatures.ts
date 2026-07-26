/**
 * TemporalFeatures.ts
 * Helper utility for circadian rhythm time encoding and temporal feature extraction.
 */

export interface TemporalEncoding {
  timeOfDay: 'Morning' | 'Afternoon' | 'Evening' | 'Night';
  dayType: 'Weekday' | 'Weekend';
  hour: number;
}

export class TemporalFeatures {
  public static encode(dateOrMs: Date | number = new Date()): TemporalEncoding {
    const date = typeof dateOrMs === 'number' ? new Date(dateOrMs) : dateOrMs;
    const hour = date.getHours();
    const day = date.getDay(); // 0 = Sunday, 6 = Saturday

    let timeOfDay: 'Morning' | 'Afternoon' | 'Evening' | 'Night' = 'Night';
    if (hour >= 6 && hour < 12) {
      timeOfDay = 'Morning';
    } else if (hour >= 12 && hour < 16) {
      timeOfDay = 'Afternoon';
    } else if (hour >= 16 && hour < 19) {
      timeOfDay = 'Evening';
    } else {
      timeOfDay = 'Night';
    }

    const dayType: 'Weekday' | 'Weekend' = (day === 0 || day === 6) ? 'Weekend' : 'Weekday';

    return {
      timeOfDay,
      dayType,
      hour,
    };
  }
}
