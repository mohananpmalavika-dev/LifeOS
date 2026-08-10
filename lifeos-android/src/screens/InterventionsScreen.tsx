/**
 * Interventions Screen
 * 
 * Shows passive interventions that LifeOS has suggested.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Intervention } from '../services/InterventionEngine';

interface InterventionsScreenProps {
  interventions: Intervention[];
  onAcknowledge: (id: string) => void;
}

export const InterventionsScreen: React.FC<InterventionsScreenProps> = ({
  interventions,
  onAcknowledge,
}) => {
  const getTypeIcon = (type: string): string => {
    const iconMap: Record<string, string> = {
      'REMINDER': '⏰',
      'SUGGESTION': '💡',
      'WARNING': '⚠️',
      'INFO': 'ℹ️',
    };
    return iconMap[type] || '📌';
  };

  const getPriorityColor = (priority: string): string => {
    const colorMap: Record<string, string> = {
      'URGENT': '#F44336',
      'HIGH': '#FF9800',
      'MEDIUM': '#2196F3',
      'LOW': '#9E9E9E',
    };
    return colorMap[priority] || '#9E9E9E';
  };

  if (interventions.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>✨</Text>
          <Text style={styles.emptyTitle}>No interventions yet</Text>
          <Text style={styles.emptySubtitle}>
            LifeOS will notify you when it detects something important
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Interventions</Text>
        <Text style={styles.headerSubtitle}>
          {interventions.length} passive suggestions
        </Text>
      </View>

      {interventions.map((intervention) => (
        <View
          key={intervention.id}
          style={[
            styles.interventionCard,
            intervention.acknowledged && styles.acknowledgedCard,
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={styles.typeContainer}>
              <Text style={styles.typeIcon}>{getTypeIcon(intervention.type)}</Text>
              <View
                style={[
                  styles.priorityBadge,
                  { backgroundColor: getPriorityColor(intervention.priority) },
                ]}
              >
                <Text style={styles.priorityText}>{intervention.priority}</Text>
              </View>
            </View>
            <Text style={styles.timestamp}>
              {new Date(intervention.timestamp).toLocaleTimeString()}
            </Text>
          </View>

          <Text style={styles.title}>{intervention.title}</Text>
          <Text style={styles.message}>{intervention.message}</Text>

          <View style={styles.contextInfo}>
            <Text style={styles.contextLabel}>Context:</Text>
            <Text style={styles.contextValue}>
              {intervention.context.contextType.replace(/_/g, ' ')}
            </Text>
          </View>

          {!intervention.acknowledged && (
            <TouchableOpacity
              style={styles.acknowledgeButton}
              onPress={() => onAcknowledge(intervention.id)}
            >
              <Text style={styles.acknowledgeButtonText}>Got it</Text>
            </TouchableOpacity>
          )}

          {intervention.acknowledged && (
            <View style={styles.acknowledgedBadge}>
              <Text style={styles.acknowledgedText}>✓ Acknowledged</Text>
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#212121',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#757575',
    marginTop: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#424242',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#757575',
    textAlign: 'center',
  },
  interventionCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    marginBottom: 0,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  acknowledgedCard: {
    opacity: 0.6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  typeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  timestamp: {
    fontSize: 12,
    color: '#9E9E9E',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#424242',
    lineHeight: 20,
    marginBottom: 12,
  },
  contextInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  contextLabel: {
    fontSize: 12,
    color: '#757575',
    marginRight: 6,
  },
  contextValue: {
    fontSize: 12,
    color: '#2196F3',
    textTransform: 'capitalize',
  },
  acknowledgeButton: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  acknowledgeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  acknowledgedBadge: {
    padding: 8,
    alignItems: 'center',
  },
  acknowledgedText: {
    fontSize: 12,
    color: '#4CAF50',
  },
});
