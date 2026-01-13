import React from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

export const ProgressCircle = ({ progress, size = 32, strokeWidth = 2.5 }: { progress: number, size?: number, strokeWidth?: number }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = circumference - progress * circumference;

    return (
        <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
            <Svg height={size} width={size} viewBox={`0 0 ${size} ${size}`}>
                <Circle stroke="#888" cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} opacity={0.3} />
                <Circle stroke="#3B82F6" cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
            </Svg>
        </View>
    );
};
