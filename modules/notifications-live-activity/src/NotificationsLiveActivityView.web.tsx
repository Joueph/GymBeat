import * as React from 'react';

import { NotificationsLiveActivityViewProps } from './NotificationsLiveActivity.types';

export default function NotificationsLiveActivityView(props: NotificationsLiveActivityViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
