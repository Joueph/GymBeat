import { Platform } from 'react-native';
import NotificationsLiveActivityModule from './src/NotificationsLiveActivityModule';

export async function startActivity(
  timestamp: number,
  exerciseName: string,
  currentSet: number,
  totalSets: number,
  weight: string,
  reps: string,
  dropsetCount: number
): Promise<string> {
  if (Platform.OS !== 'ios') {
    return "";
  }
  return await NotificationsLiveActivityModule.startActivity(
    timestamp,
    exerciseName,
    currentSet,
    totalSets,
    weight,
    reps,
    dropsetCount
  );
}

// R1: Adicionando a função update
export async function updateActivity(
  activityId: string,
  timestamp: number,
  exerciseName: string,
  currentSet: number,
  totalSets: number,
  weight: string,
  reps: string,
  dropsetCount: number,
  isFinished: boolean
): Promise<void> {
  if (Platform.OS !== 'ios') {
    return;
  }
  return await NotificationsLiveActivityModule.updateActivity(
    activityId,
    timestamp,
    exerciseName,
    currentSet,
    totalSets,
    weight,
    reps,
    dropsetCount,
    isFinished
  );
}

export async function endActivity(activityId: string): Promise<void> {
  if (Platform.OS !== 'ios') {
    return;
  }
  return await NotificationsLiveActivityModule.endActivity(activityId);
}

export async function listActivities(): Promise<string[]> {
  if (Platform.OS !== 'ios') {
    return [];
  }
  return await NotificationsLiveActivityModule.listActivities();
}

export function reloadWidgetTimelines() {
  if (Platform.OS !== 'ios') {
    return;
  }
  return NotificationsLiveActivityModule.reloadAllTimelines();
}

export function setWidgetData(key: string, jsonValue: string) {
  if (Platform.OS !== 'ios') {
    return;
  }
  return NotificationsLiveActivityModule.setWidgetData(key, jsonValue);
}