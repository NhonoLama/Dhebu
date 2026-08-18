import { NativeModule, requireNativeModule } from 'expo';

import { DhebuNotificationsModuleEvents } from './DhebuNotifications.types';

declare class DhebuNotificationsModule extends NativeModule<DhebuNotificationsModuleEvents> {
  setValueAsync(value: string): Promise<void>;
}

export default requireNativeModule<DhebuNotificationsModule>('DhebuNotifications');
