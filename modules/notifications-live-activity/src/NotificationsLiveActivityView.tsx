import { requireNativeView } from 'expo';
import * as React from 'react';

import { NotificationsLiveActivityViewProps } from './NotificationsLiveActivity.types';

const NativeView: React.ComponentType<NotificationsLiveActivityViewProps> =
  requireNativeView('NotificationsLiveActivity');

export default function NotificationsLiveActivityView(props: NotificationsLiveActivityViewProps) {
  return <NativeView {...props} />;
}
