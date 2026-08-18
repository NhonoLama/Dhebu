import { registerWebModule, NativeModule } from 'expo';

import { DhebuNotificationsModuleEvents } from './DhebuNotifications.types';

class DhebuNotificationsModule extends NativeModule<DhebuNotificationsModuleEvents> {
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
}

export default registerWebModule(DhebuNotificationsModule, 'DhebuNotificationsModule');
