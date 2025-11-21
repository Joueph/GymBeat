import { registerWebModule, NativeModule } from 'expo';

import { ChangeEventPayload } from './NotificationsLiveActivity.types';

type NotificationsLiveActivityModuleEvents = {
  onChange: (params: ChangeEventPayload) => void;
}

class NotificationsLiveActivityModule extends NativeModule<NotificationsLiveActivityModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
};

export default registerWebModule(NotificationsLiveActivityModule, 'NotificationsLiveActivityModule');
