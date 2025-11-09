import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

interface WeightData {
  valor: number;
  data: any; // Can be Date or Firestore Timestamp
}

interface WeightHistoryChartProps {
  data: WeightData[];
}

const toDate = (date: any): Date => {
  if (date.toDate) return date.toDate();
  return new Date(date);
};

export const WeightHistoryChart: React.FC<WeightHistoryChartProps> = ({ data }) => {
  if (!data || data.length < 2) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>Dados insuficientes para o gráfico</Text>
      </View>
    );
  }

  const sortedData = data.map(d => ({ ...d, data: toDate(d.data) })).sort((a, b) => a.data.getTime() - b.data.getTime());

  const width = '100%';
  const height = 80;
  const padding = 15;

  const minWeight = Math.min(...sortedData.map(d => d.valor));
  const maxWeight = Math.max(...sortedData.map(d => d.valor));
  const startTime = sortedData[0].data.getTime();
  const endTime = sortedData[sortedData.length - 1].data.getTime();

  const getX = (time: number) => {
    if (endTime === startTime) return padding;
    return ((time - startTime) / (endTime - startTime)) * (180 - 2 * padding) + padding;
  };

  const getY = (weight: number) => {
    if (maxWeight === minWeight) return height / 2;
    return height - (((weight - minWeight) / (maxWeight - minWeight)) * (height - 2 * padding) + padding);
  };


  const linePath = sortedData
    .map((point, i) => {
      const x = getX(point.data.getTime());
      const y = getY(point.valor);
      return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
    })
    .join(' ');

  const areaPath = `${linePath} V ${height} L ${getX(sortedData[0].data.getTime())},${height} Z`;

  return (
    <View style={styles.container}>
      <Svg height={height} width={width}>
        <Defs>
          <LinearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#3B82F6" stopOpacity={0.3} />
            <Stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={areaPath} fill="url(#gradient)" />
        <Path d={linePath} fill="none" stroke="#3B82F6" strokeWidth="2" />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: 80,
    backgroundColor: '#111317',
    borderRadius: 8,
  },
  placeholderText: {
    color: '#555',
    fontSize: 12,
  },
});