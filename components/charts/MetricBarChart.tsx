import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

interface MetricData {
    valor: number;
    data: any; // Can be Date or Firestore Timestamp
}

interface MetricBarChartProps {
    data: MetricData[];
}

const toDate = (date: any): Date => {
    if (date.toDate) return date.toDate();
    return new Date(date);
};

export const MetricBarChart: React.FC<MetricBarChartProps> = ({ data }) => {
    const [width, setWidth] = React.useState(0);
    const height = 80;
    const padding = 5;

    const handleLayout = (event: any) => {
        setWidth(event.nativeEvent.layout.width);
    };

    // 1. Ordena os dados por data
    const sortedData = data
        .map(d => ({ ...d, data: toDate(d.data) }))
        .sort((a, b) => a.data.getTime() - b.data.getTime());

    if (width === 0) {
        return <View style={styles.container} onLayout={handleLayout} />;
    }

    // If no data, show nothing or placeholder (handled by parent usually, but just in case)
    if (sortedData.length === 0) {
        return <View style={styles.container} onLayout={handleLayout} />;
    }

    // Dynamic data slicing based on width
    // Target slot width of ~35px per bar (including gap) for consistent look
    const targetSlotWidth = 35;
    const maxItems = Math.floor((width - padding * 2) / targetSlotWidth);
    // Ensure at least 5 items if possible, or all data if less
    const numItemsToShow = Math.max(5, Math.min(maxItems, sortedData.length));

    const displayData = sortedData.slice(-numItemsToShow);

    const values = displayData.map(d => d.valor);
    const maxValue = Math.max(...values, 1); // Avoid div by zero

    const barWidth = (width - (padding * 2)) / displayData.length * 0.6; // 60% width, 40% gap
    const gap = (width - (padding * 2)) / displayData.length;

    return (
        <View style={styles.container} onLayout={handleLayout}>
            <Svg height={height} width="100%" viewBox={`0 0 ${width} ${height}`}>
                <Defs>
                    <LinearGradient id="bar-gradient" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0%" stopColor="#3B82F6" stopOpacity={0.8} />
                        <Stop offset="100%" stopColor="#3B82F6" stopOpacity={0.3} />
                    </LinearGradient>
                </Defs>

                {displayData.map((d, index) => {
                    // Calculate height proportional to max value
                    const barHeight = (d.valor / maxValue) * (height - padding * 2);
                    const x = padding + (index * gap) + (gap - barWidth) / 2;
                    const y = height - barHeight - padding;

                    return (
                        <Rect
                            key={index}
                            x={x}
                            y={y}
                            width={barWidth}
                            height={barHeight}
                            rx={4} // Rounded corners
                            fill="url(#bar-gradient)"
                        />
                    );
                })}
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
});
