/**
 * LifeOS Android Passive Agent
 * Main Application Entry Point
 */

import React, { useState, useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import * as Notifications from 'expo-notifications';

import { EventFactory } from './src/core/EventFactory';
import { EventPipeline } from './src/local/EventPipeline';
import { ContextService } from './src/services/ContextService';
import { InterventionEngine, Intervention } from './src/services/InterventionEngine';

import { NowScreen } from './src/screens/NowScreen';
import { InterventionsScreen } from './src/screens/InterventionsScreen';

// Configuration
const CONFIG = {
  userId: 'user_demo_001',
  deviceId: 'device_android_001',
  apiBaseUrl: 'http://localhost:3001',  // Update with your backend URL
  
  collectors: {
    notification: {
      enabled: true,
      filterSystemNotifications: true,
      userPrivacySettings: {
        shareMessaging: false,      // Don't share WhatsApp/Telegram by default
        shareEmail: false,          // Don't share email content
        shareFinancial: false,      // Never share banking
      },
    },
    calendar: {
      enabled: true,
      lookAheadHours: 48,
      syncIntervalMinutes: 30,
      includeAllDayEvents: true,
    },
    location: {
      enabled: true,
      distanceInterval: 50,
      timeInterval: 60000,
      enablePlaceDetection: true,
      knownPlaces: [
        {
          id: 'home',
          type: 'HOME',
          name: 'Home',
          latitude: 8.8932,
          longitude: 76.6141,
          radiusMeters: 100,
        },
        {
          id: 'work',
          type: 'WORK',
          name: 'Office',
          latitude: 8.5241,
          longitude: 76.9366,
          radiusMeters: 150,
        },
      ],
    },
    activity: {
      enabled: true,
      samplingIntervalMs: 1000,
      detectionWindowMs: 10000,
      confidenceThreshold: 0.6,
    },
  },
  
  sync: {
    enabled: true,
    batchSize: 50,
    syncIntervalMs: 300000,        // 5 minutes
    retryAttempts: 3,
    wifiOnly: false,
  },
};

const Tab = createBottomTabNavigator();

export default function App() {
  const [pipeline, setPipeline] = useState<EventPipeline | null>(null);
  const [contextService, setContextService] = useState<ContextService | null>(null);
  const [interventionEngine, setInterventionEngine] = useState<InterventionEngine | null>(null);
  const [interventions, setInterventions] = useState<Intervention[]>([]);

  useEffect(() => {
    initializeApp();

    return () => {
      if (pipeline) {
        pipeline.stop();
      }
      if (interventionEngine) {
        interventionEngine.stop();
      }
    };
  }, []);

  const initializeApp = async () => {
    try {
      console.log('[App] Initializing LifeOS Passive Agent');

      // Initialize EventFactory
      EventFactory.initialize(CONFIG.deviceId, CONFIG.userId);

      // Initialize Context Service
      const ctx = new ContextService(CONFIG.apiBaseUrl, CONFIG.userId);
      setContextService(ctx);

      // Initialize Intervention Engine
      const ie = new InterventionEngine(ctx);
      setInterventionEngine(ie);
      ie.start();

      // Update interventions every minute
      setInterval(() => {
        if (ie) {
          setInterventions(ie.getInterventions());
        }
      }, 60000);

      // Initialize Event Pipeline
      const ep = new EventPipeline(CONFIG);
      setPipeline(ep);
      
      // Start pipeline
      await ep.start();

      console.log('[App] LifeOS Passive Agent initialized successfully');

      // Show welcome notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🌐 LifeOS Active',
          body: 'Passive Agent is now monitoring your context',
        },
        trigger: null,
      });

    } catch (error) {
      console.error('[App] Initialization error:', error);
    }
  };

  const handleAcknowledgeIntervention = (interventionId: string) => {
    if (interventionEngine) {
      interventionEngine.acknowledgeIntervention(interventionId);
      setInterventions(interventionEngine.getInterventions());
    }
  };

  if (!contextService || !interventionEngine) {
    return null; // Show loading screen
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: '#2196F3',
            tabBarInactiveTintColor: '#9E9E9E',
          }}
        >
          <Tab.Screen
            name="Now"
            options={{
              tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>📍</Text>,
            }}
          >
            {() => <NowScreen contextService={contextService} />}
          </Tab.Screen>
          
          <Tab.Screen
            name="Interventions"
            options={{
              tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>💡</Text>,
              tabBarBadge: interventions.filter(i => !i.acknowledged).length || undefined,
            }}
          >
            {() => (
              <InterventionsScreen
                interventions={interventions}
                onAcknowledge={handleAcknowledgeIntervention}
              />
            )}
          </Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
