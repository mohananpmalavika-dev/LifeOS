/**
 * Now Screen
 * 
 * Shows the user's current life context in real-time.
 * This is the most important screen - proving the Passive Agent is understanding life.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { ContextService, FusedContext } from '../services/ContextService';

interface NowScreenProps {
  contextService: ContextService;
}

export const NowScreen: React.FC<NowScreenProps> = ({ contextService }) => {
  const [context, setContext] = useState<FusedContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadContext();
    
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      loadContext();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadContext = async () => {
    try {
      const currentContext = await contextService.getCurrentContext();
      setContext(currentContext);
    } catch (error) {
      console.error('Error loading context:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadContext();
  };

  const getContextEmoji = (contextType: string): string => {
    const emojiMap: Record<string, string> = {
      'COMMUTING': '🚗',
      'TRAVELING_HOME': '🏠',
      'TRAVELING_TO_MEETING': '📍',
      'AT_HOME': '🏠',
      'AT_WORK': '💼',
      'AT_GYM': '💪',
      'SHOPPING': '🛒',
      'IN_MEETING': '📅',
      'UPCOMING_MEETING': '⏰',
      'MEETING_SOON': '🔔',
      'WORKING': '💻',
      'EXERCISING': '🏃',
      'RESTING': '😌',
      'SOCIAL_ACTIVITY': '👥',
      'UNKNOWN': '❓',
    };
    return emojiMap[contextType] || '📊';
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return '#4CAF50';
    if (confidence >= 0.6) return '#FFC107';
    return '#FF9800';
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.loadingText}>Loading your context...</Text>
        </View>
      </View>
    );
  }

  if (!context) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.emoji}>🌐</Text>
          <Text style={styles.noContextText}>No recent activity detected</Text>
          <Text style={styles.subtitle}>
            LifeOS is monitoring your context
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.time}>{new Date().toLocaleTimeString()}</Text>
        <Text style={styles.headerTitle}>NOW</Text>
      </View>

      <View style={styles.contextCard}>
        <Text style={styles.contextEmoji}>
          {getContextEmoji(context.contextType)}
        </Text>
        <Text style={styles.contextType}>
          {context.contextType.replace(/_/g, ' ')}
        </Text>
        <View style={styles.confidenceBadge}>
          <View
            style={[
              styles.confidenceDot,
              { backgroundColor: getConfidenceColor(context.confidence) },
            ]}
          />
          <Text style={styles.confidenceText}>
            {Math.round(context.confidence * 100)}% confident
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>What's happening</Text>
        <Text style={styles.description}>{context.insights.description}</Text>
      </View>

      {context.insights.key_signals.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detected signals</Text>
          {context.insights.key_signals.map((signal, index) => (
            <View key={index} style={styles.signalItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.signalText}>{signal}</Text>
            </View>
          ))}
        </View>
      )}

      {context.recommendations && context.recommendations.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💡 Suggestions</Text>
          {context.recommendations.map((rec, index) => (
            <View key={index} style={styles.recommendationCard}>
              <Text style={styles.recommendationText}>{rec}</Text>
            </View>
          ))}
        </View>
      )}

      {context.metadata && Object.keys(context.metadata).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          {Object.entries(context.metadata).map(([key, value]) => (
            <View key={key} style={styles.metadataRow}>
              <Text style={styles.metadataKey}>{key}:</Text>
              <Text style={styles.metadataValue}>{String(value)}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Updated: {new Date(context.startTime).toLocaleString()}
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    backgroundColor: '#2196F3',
    padding: 20,
    paddingTop: 60,
    alignItems: 'center',
  },
  time: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 16,
    color: '#E3F2FD',
    marginTop: 8,
    letterSpacing: 2,
  },
  contextCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  contextEmoji: {
    fontSize: 64,
    marginBottom: 12,
  },
  contextType: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212121',
    textTransform: 'capitalize',
    marginBottom: 12,
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  confidenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  confidenceText: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#424242',
    lineHeight: 24,
  },
  signalItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  bullet: {
    marginRight: 8,
    color: '#2196F3',
    fontSize: 16,
  },
  signalText: {
    flex: 1,
    fontSize: 14,
    color: '#616161',
  },
  recommendationCard: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#2196F3',
  },
  recommendationText: {
    fontSize: 14,
    color: '#1565C0',
  },
  metadataRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  metadataKey: {
    fontSize: 14,
    color: '#757575',
    fontWeight: '500',
    marginRight: 8,
  },
  metadataValue: {
    flex: 1,
    fontSize: 14,
    color: '#424242',
  },
  footer: {
    padding: 16,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#9E9E9E',
  },
  loadingText: {
    fontSize: 16,
    color: '#757575',
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  noContextText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#424242',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#757575',
  },
});
