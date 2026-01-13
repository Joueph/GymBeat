import { NativeModule, requireNativeModule } from 'expo';

import { NotificationsLiveActivityModuleEvents } from './NotificationsLiveActivity.types';

declare class NotificationsLiveActivityModule extends NativeModule<NotificationsLiveActivityModuleEvents> {
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;
  listActivities(): Promise<string[]>;
  updateActivity(activityId: string, timestamp: number, exerciseName: string, currentSet: number, totalSets: number, weight: string, reps: string, dropsetCount: number, isFinished: boolean): Promise<void>;

  startActivity(timestamp: number, exerciseName: string, currentSet: number, totalSets: number, weight: string, reps: string, dropsetCount: number): Promise<string | null>;
  endActivity(activityId: string): Promise<void>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<NotificationsLiveActivityModule>('NotificationsLiveActivity');
