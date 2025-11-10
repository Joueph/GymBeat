import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

interface MetricData {
  valor: number;
  data: any; // Can be Date or Firestore Timestamp
}

interface MetricHistoryChartProps {
  data: MetricData[];
}

interface Point {
  x: number;
  y: number;
}

const toDate = (date: any): Date => {
  if (date.toDate) return date.toDate();
  return new Date(date);
};

export const MetricHistoryChart: React.FC<MetricHistoryChartProps> = ({ data }) => {
  // 1. Ordena os dados por data
  const sortedData = data
    .map(d => ({ ...d, data: toDate(d.data) }))
    .sort((a, b) => a.data.getTime() - b.data.getTime());

  // 2. Aplica uma suavização (média móvel) para deixar a curva mais natural
  const smoothedData = sortedData.map((point, index, array) => {
    if (index === 0 || index === array.length - 1 || array.length < 3) {
      return point; // Mantém o primeiro e o último ponto intactos
    }
    const prev = array[index - 1];
    const next = array[index + 1];
    return { ...point, valor: (prev.valor + point.valor + next.valor) / 3 };
  });

  const width = 180;
  const height = 80;
  const padding = 5;

  if (sortedData.length === 1) {
    return (
        <View style={styles.container}>
            <Svg height={height} width="100%" viewBox={`0 0 ${width} ${height}`}>
                <Circle cx={width/2} cy={height/2} r="3" fill="#3B82F6" />
            </Svg>
        </View>
    );
  }

  const values = smoothedData.map(d => d.valor);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  
  const valueRange = Math.max(1, maxValue - minValue);
  const paddedMinValue = minValue - valueRange * 0.1;
  const paddedMaxValue = maxValue + valueRange * 0.1;
  
  const startTime = smoothedData[0].data.getTime();
  const endTime = smoothedData[smoothedData.length - 1].data.getTime();

  const getX = (time: number) => {
    if (endTime === startTime) return width / 2;
    return ((time - startTime) / (endTime - startTime)) * (width - 2 * padding) + padding;
  };

  const getY = (value: number) => {
    if (paddedMaxValue === paddedMinValue) return height / 2;
    return height - (((value - paddedMinValue) / (paddedMaxValue - paddedMinValue)) * (height - 2 * padding) + padding);
  };

  const createPath = (d: {valor: number, data: Date}[]) => {
    if (d.length < 2) {
        return d.length === 1 ? `M ${getX(d[0].data.getTime())},${getY(d[0].valor)}` : '';
    }

    const points = d.map(point => ({
        x: getX(point.data.getTime()),
        y: getY(point.valor)
    }));

    const line = (pointA: Point, pointB: Point) => {
        const lengthX = pointB.x - pointA.x;
        const lengthY = pointB.y - pointA.y;
        return {
            length: Math.sqrt(Math.pow(lengthX, 2) + Math.pow(lengthY, 2)),
            angle: Math.atan2(lengthY, lengthX)
        };
    };

    const controlPoint = (current: Point, previous: Point | undefined, next: Point | undefined, reverse: boolean) => {
        const p = previous || current;
        const n = next || current;
        const smoothing = 0.2; // Ajustado para uma curva mais suave
        const o = line(p, n);
        const angle = o.angle + (reverse ? Math.PI : 0);
        const length = o.length * smoothing;
        const x = current.x + Math.cos(angle) * length;
        const y = current.y + Math.sin(angle) * length;
        return [x, y];
    };

    const path = points.reduce((acc, point, i, a) => {
        if (i === 0) return `M ${point.x.toFixed(2)},${point.y.toFixed(2)}`;
        const [cpsX, cpsY] = controlPoint(a[i - 1], a[i - 2], point, false);
        const [cpeX, cpeY] = controlPoint(point, a[i - 1], a[i + 1], true);
        return `${acc} C ${cpsX.toFixed(2)},${cpsY.toFixed(2)} ${cpeX.toFixed(2)},${cpeY.toFixed(2)} ${point.x.toFixed(2)},${point.y.toFixed(2)}`;
    }, '');

    return path;
  };

  const fullPath = createPath(smoothedData);
  
  const createAreaPath = (path: string, d: {valor: number, data: Date}[]) => {
      if (!path || d.length === 0) return '';
      const firstPoint = d[0];
      const lastPoint = d[d.length - 1];
      return `${path} L ${getX(lastPoint.data.getTime())},${height} L ${getX(firstPoint.data.getTime())},${height} Z`;
  }
  const areaPath = createAreaPath(fullPath, smoothedData);

  const breakPointIndex = smoothedData.length > 7 ? smoothedData.length - 7 : Math.floor(smoothedData.length / 2);
  const thisWeekData = smoothedData.slice(breakPointIndex);
  const thisWeekStartX = thisWeekData.length > 0 ? getX(thisWeekData[0].data.getTime()) : width;


  return (
    <View style={styles.container}>
      <Svg height={height} width="100%" viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#3B82F6" stopOpacity={0.3} />
            <Stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
          </LinearGradient>
           <LinearGradient id="gradient-faded" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#3B82F6" stopOpacity={0.1} />
            <Stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
          </LinearGradient>
          <ClipPath id="clip-last-week">
            <Rect x="0" y="0" width={thisWeekStartX} height={height} />
          </ClipPath>
          <ClipPath id="clip-this-week">
              <Rect x={thisWeekStartX} y="0" width={width - thisWeekStartX} height={height} />
          </ClipPath>
        </Defs>
        
        {areaPath && <Path d={areaPath} fill="url(#gradient-faded)" clipPath="url(#clip-last-week)" />}
        {areaPath && <Path d={areaPath} fill="url(#gradient)" clipPath="url(#clip-this-week)" />}

        {fullPath && <Path d={fullPath} fill="none" stroke="#3B82F6" strokeWidth="2" strokeOpacity={0.5} clipPath="url(#clip-last-week)" />}
        {fullPath && <Path d={fullPath} fill="none" stroke="#3B82F6" strokeWidth="2.5" clipPath="url(#clip-this-week)" />}
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
