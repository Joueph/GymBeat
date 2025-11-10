import { FontAwesome } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MetricHistoryChart } from './charts/MetricHistoryChart';

interface MetricCardProps {
  metricName: string;
  metricValue: string;
  isEditable?: boolean;
  onEdit?: () => void;
  historyData?: { valor: number; data: Date }[];
}

export const MetricCard: React.FC<MetricCardProps> = ({ metricName, metricValue, isEditable, onEdit, historyData }) => {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.metricName}>{metricName}</Text>
        {isEditable && (
          <TouchableOpacity onPress={onEdit} style={styles.editButton}>
            <FontAwesome name="pencil" size={14} color="#888" />
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.metricValue}>{metricValue}</Text>
      {historyData && historyData.length > 1 ? (
        <MetricHistoryChart data={historyData} />
      ) : (
        <View style={styles.chartPlaceholder}>
          <FontAwesome name="line-chart" size={30} color="#444" />
          <Text style={styles.chartPlaceholderText}>Gráfico da métrica</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1A1D23',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#2A2E37',
    width: '48%', // Para caber dois cards por linha com um espaço
    overflow: 'hidden', // Garante que o gráfico não vaze
    marginBottom: 8, // Adicionado para o espaçamento vertical
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    paddingHorizontal: 15, // Adicionado padding
    paddingTop: 15, // Adicionado padding
  },
  editButton: {
    padding: 5,
  },
  metricName: {
    color: '#AAA',
    fontSize: 14,
    fontWeight: '500',
  },
  metricValue: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 8,
    paddingHorizontal: 15, // Adicionado padding
  },
  chartPlaceholder: {
    height: 80,
    backgroundColor: '#111317',
    borderRadius: 8,
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#222',
    gap: 8,
  },
  chartPlaceholderText: {
    color: '#555',
    fontSize: 12,
    fontWeight: '500',
  },
});