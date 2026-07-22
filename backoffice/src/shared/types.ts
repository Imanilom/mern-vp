export interface Participant {
  id: string;
  status: 'Active' | 'Inactive';
  device: string;
  lastSeen: string;
  completeness: number;
  currentActivity: string;
  trajectoryStatus: 'Stable' | 'Recovering' | 'Deviation' | 'No data';
  activeAlerts: number;
}

export interface SensorReading {
  timestamp: string;
  participantId: string;
  heartRate: number;
  rrInterval: number;
  activity: string;
  signalQuality: number;
  status: 'Valid' | 'Invalid';
}

export interface TrajectoryEvent {
  eventId: string;
  participantId: string;
  activity: string;
  startTime: string;
  magnitude: number;
  duration: string;
  recoveryPercentage: number;
  status: 'New' | 'Under review' | 'Validated' | 'False positive' | 'Closed';
}

export interface PreprocessingJob {
  jobId: string;
  participantId: string;
  batchSize: number;
  progress: number;
  status: 'Running' | 'Completed' | 'Failed';
}

export interface ActivityMetric {
  activity: string;
  windows: number;
  duration: string;
  hrMean: number;
  hrSd: number;
  rmssd: number;
  dfaAlpha1: number;
  readiness: 'Ready' | 'Learning';
}

export interface User {
  email: string;
  name: string;
  role: 'Administrator' | 'Researcher' | 'Analyst' | 'Clinician' | 'Operator' | 'Field Officer';
  status: 'Active' | 'Inactive';
  lastLogin: string;
}
