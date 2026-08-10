/**
 * Device Registration and Management API
 * 
 * Handles Android/iOS device registration, heartbeat, and configuration.
 */

import { Router } from 'express';
import { nanoid } from 'nanoid';
import type { 
  DeviceRegistration, 
  ApiResponse,
  SyncStatus 
} from '../../types/life-event.js';

const router = Router();

// In-memory device registry (replace with database in production)
const devices = new Map<string, DeviceRegistration>();
const devicesByUser = new Map<string, Set<string>>();

/**
 * POST /api/v1/devices/register
 * Register a new device or update existing registration
 */
router.post('/register', async (req, res) => {
  try {
    const {
      userId,
      deviceName,
      platform,
      osVersion,
      appVersion,
      collectors,
      privacy,
      sync,
      publicKey,
    } = req.body;

    // Validation
    if (!userId || !deviceName || !platform) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Missing required fields: userId, deviceName, platform',
        },
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    }

    // Generate or reuse device ID
    const deviceId = req.body.deviceId || `dev_${nanoid(16)}`;

    const device: DeviceRegistration = {
      deviceId,
      userId,
      deviceName,
      platform,
      osVersion: osVersion || 'unknown',
      appVersion: appVersion || '0.1.0',
      collectors: collectors || {
        notification: false,
        calendar: false,
        location: false,
        activity: false,
      },
      privacy: privacy || {
        syncEnabled: true,
        dataRetentionDays: 90,
      },
      sync: sync || {
        batchSize: 100,
        batchIntervalMs: 300000, // 5 minutes
        retryAttempts: 3,
        wifiOnly: false,
      },
      publicKey,
      registeredAt: new Date().toISOString(),
      lastHeartbeat: new Date().toISOString(),
    };

    // Store device
    devices.set(deviceId, device);

    // Track devices per user
    if (!devicesByUser.has(userId)) {
      devicesByUser.set(userId, new Set());
    }
    devicesByUser.get(userId)!.add(deviceId);

    console.log(`📱 Device registered: ${deviceId} for user ${userId} (${platform})`);

    res.json({
      success: true,
      data: {
        deviceId,
        config: {
          collectors: device.collectors,
          privacy: device.privacy,
          sync: device.sync,
        },
      },
      timestamp: new Date().toISOString(),
    } as ApiResponse);

  } catch (error: any) {
    console.error('Device registration error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'REGISTRATION_FAILED',
        message: error.message,
      },
      timestamp: new Date().toISOString(),
    } as ApiResponse);
  }
});

/**
 * POST /api/v1/devices/heartbeat
 * Update device heartbeat timestamp
 */
router.post('/heartbeat', async (req, res) => {
  try {
    const { deviceId } = req.body;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Missing deviceId',
        },
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    }

    const device = devices.get(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'DEVICE_NOT_FOUND',
          message: 'Device not registered',
        },
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    }

    device.lastHeartbeat = new Date().toISOString();
    devices.set(deviceId, device);

    res.json({
      success: true,
      data: {
        status: 'alive',
        lastHeartbeat: device.lastHeartbeat,
      },
      timestamp: new Date().toISOString(),
    } as ApiResponse);

  } catch (error: any) {
    console.error('Heartbeat error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'HEARTBEAT_FAILED',
        message: error.message,
      },
      timestamp: new Date().toISOString(),
    } as ApiResponse);
  }
});

/**
 * GET /api/v1/devices/config
 * Get device configuration
 */
router.get('/config', async (req, res) => {
  try {
    const { deviceId } = req.query;

    if (!deviceId || typeof deviceId !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Missing deviceId',
        },
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    }

    const device = devices.get(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'DEVICE_NOT_FOUND',
          message: 'Device not registered',
        },
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    }

    res.json({
      success: true,
      data: {
        collectors: device.collectors,
        privacy: device.privacy,
        sync: device.sync,
      },
      timestamp: new Date().toISOString(),
    } as ApiResponse);

  } catch (error: any) {
    console.error('Config fetch error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CONFIG_FETCH_FAILED',
        message: error.message,
      },
      timestamp: new Date().toISOString(),
    } as ApiResponse);
  }
});

/**
 * GET /api/v1/devices/list
 * List all devices for a user
 */
router.get('/list', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Missing userId',
        },
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    }

    const userDeviceIds = devicesByUser.get(userId) || new Set();
    const userDevices = Array.from(userDeviceIds)
      .map(id => devices.get(id))
      .filter(Boolean);

    res.json({
      success: true,
      data: {
        devices: userDevices,
        count: userDevices.length,
      },
      timestamp: new Date().toISOString(),
    } as ApiResponse);

  } catch (error: any) {
    console.error('Device list error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'LIST_FAILED',
        message: error.message,
      },
      timestamp: new Date().toISOString(),
    } as ApiResponse);
  }
});

/**
 * DELETE /api/v1/devices/:deviceId
 * Unregister a device
 */
router.delete('/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;

    const device = devices.get(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'DEVICE_NOT_FOUND',
          message: 'Device not registered',
        },
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    }

    // Remove from maps
    devices.delete(deviceId);
    const userDevices = devicesByUser.get(device.userId);
    if (userDevices) {
      userDevices.delete(deviceId);
    }

    console.log(`📱 Device unregistered: ${deviceId}`);

    res.json({
      success: true,
      data: {
        message: 'Device unregistered successfully',
      },
      timestamp: new Date().toISOString(),
    } as ApiResponse);

  } catch (error: any) {
    console.error('Device deletion error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DELETION_FAILED',
        message: error.message,
      },
      timestamp: new Date().toISOString(),
    } as ApiResponse);
  }
});

export { router as devicesRouter, devices };
