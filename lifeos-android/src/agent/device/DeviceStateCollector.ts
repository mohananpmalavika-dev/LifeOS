import { BaseCollector, CollectorConfig, CollectorStatus } from '../BaseCollector';
import { LifeEvent, EventType, SourceType, SensitivityLevel } from '../../core/LifeEvent';

export interface DeviceStateCollectorConfig extends CollectorConfig {
  monitorIntervalMs?: number;
}

export class DeviceStateCollector extends BaseCollector {
  private intervalId?: NodeJS.Timeout;

  constructor(config: DeviceStateCollectorConfig) {
    super(config);
  }

  async start(): Promise<void> {
    this.status = CollectorStatus.STARTING;
    const intervalMs = this.config.samplingIntervalMs || 60000;
    
    // Perform initial reading
    await this.captureState();

    this.intervalId = setInterval(async () => {
      await this.captureState();
    }, intervalMs);

    this.status = CollectorStatus.RUNNING;
  }

  async stop(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.status = CollectorStatus.STOPPED;
  }

  async checkPermissions(): Promise<boolean> {
    return true; // Battery/network state does not require runtime permissions on Android
  }

  async requestPermissions(): Promise<boolean> {
    return true;
  }

  getName(): string {
    return 'DeviceStateCollector';
  }

  private async captureState(): Promise<void> {
    try {
      const now = new Date();
      // On actual Android device, Battery.getBatteryLevelAsync() / Network.getNetworkStateAsync()
      const event: LifeEvent = {
        eventId: `evt_dev_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        userId: 'local_user',
        deviceId: 'android_primary',
        type: EventType.DEVICE_STATE,
        timestamp: now.toISOString(),
        source: {
          type: SourceType.ANDROID,
          collector: 'device_state',
        },
        data: {
          batteryLevel: 78,
          charging: false,
          online: true,
          networkType: 'WIFI',
          powerSaveMode: false,
        },
        confidence: 1.0,
        privacy: {
          sensitivity: SensitivityLevel.PUBLIC,
          localOnly: false,
        },
        createdAt: now.toISOString(),
      };

      if (this.eventCallback) {
        this.eventCallback(event);
      }
    } catch (error: any) {
      if (this.errorCallback) {
        this.errorCallback(error);
      }
    }
  }
}
