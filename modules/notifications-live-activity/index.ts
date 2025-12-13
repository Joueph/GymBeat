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
  dropsetCount: number
): Promise<void> {
  return await NotificationsLiveActivityModule.updateActivity(
    activityId,
    timestamp,
    exerciseName,
    currentSet,
    totalSets,
    weight,
    reps,
    dropsetCount
  );
}

export async function endActivity(activityId: string): Promise<void> {
  return await NotificationsLiveActivityModule.endActivity(activityId);
}

export function reloadWidgetTimelines() {
  return NotificationsLiveActivityModule.reloadAllTimelines();
}