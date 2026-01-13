import { NativeModule, requireNativeModule } from 'expo';

import { NotificationsLiveActivityModuleEvents } from './NotificationsLiveActivity.types';

declare class NotificationsLiveActivityModule extends NativeModule<NotificationsLiveActivityModuleEvents> {
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;
  listActivities(): Promise<string[]>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<NotificationsLiveActivityModule>('NotificationsLiveActivity');
