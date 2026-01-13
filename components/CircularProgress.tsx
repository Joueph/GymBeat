import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    Easing,
    cancelAnimation,
    useAnimatedProps,
    useSharedValue,
    withTiming
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

interface CircularProgressProps {
    progress: number; // 0 to 1
    size?: number;
    strokeWidth?: number;
    color?: string;
    backgroundColor?: string;
    duration?: number; // If provided, self-animates from 0 to 1
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const CircularProgress: React.FC<CircularProgressProps> = ({
    progress,
    size = 40,
    strokeWidth = 3,
    color = '#3B82F6',
    backgroundColor = '#333',
    duration
}) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const animatedProgress = useSharedValue(progress);

    useEffect(() => {
        if (duration && duration > 0) {
            // Self-animating mode
            // Reset first
            animatedProgress.value = progress;
            // Animate to 1
            const remainingTime = duration * (1 - progress) * 1000;

            animatedProgress.value = withTiming(1, {
                duration: Math.max(0, remainingTime),
                easing: Easing.linear
            });
        } else {
            // Controlled mode
            animatedProgress.value = withTiming(progress, { duration: 300 });
        }

        return () => {
            cancelAnimation(animatedProgress);
        }
    }, [progress, duration]);

    const animatedProps = useAnimatedProps(() => {
        return {
            strokeDashoffset: circumference * (1 - animatedProgress.value),
        };
    });

    return (
        <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
            <Svg width={size} height={size}>
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={backgroundColor}
                    strokeWidth={strokeWidth}
                    fill="transparent"
                />
                <AnimatedCircle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={color}
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    strokeDasharray={circumference}
                    animatedProps={animatedProps}
                    strokeLinecap="round"
                    rotation="-90"
                    origin={`${size / 2}, ${size / 2}`}
                />
            </Svg>
        </View>
    );
};

const styles = StyleSheet.create({});
