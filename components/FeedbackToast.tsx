import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
    runOnJS,
    useAnimatedProps,
    useAnimatedStyle,
    useSharedValue,
    withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

const CIRCLE_RADIUS = 18;
const STROKE_WIDTH = 3;
const CIRCLE_LENGTH = 2 * Math.PI * CIRCLE_RADIUS;

interface FeedbackToastProps {
    visible: boolean;
    type: 'success' | 'failure';
    title: string;
    message: string;
    duration?: number;
    onHide: () => void;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const FeedbackToast: React.FC<FeedbackToastProps> = ({
    visible,
    type,
    title,
    message,
    duration = 3000,
    onHide,
}) => {
    const insets = useSafeAreaInsets();
    const translateY = useSharedValue(-150);
    const progress = useSharedValue(0);

    // Colors based on type
    const mainColor = type === 'success' ? '#4CAF50' : '#FF5252';

    useEffect(() => {
        if (visible) {
            // Trigger haptics
            Haptics.notificationAsync(
                type === 'success'
                    ? Haptics.NotificationFeedbackType.Success
                    : Haptics.NotificationFeedbackType.Error
            );

            // Reset progress
            progress.value = 0;

            // Animate In (Slide Down)
            translateY.value = withTiming(insets.top + 10, { duration: 500 });

            // Animate Progress
            progress.value = withTiming(1, { duration: duration }, (finished) => {
                if (finished) {
                    runOnJS(handleHide)();
                }
            });
        }
        // Note: We don't automatically hide in the 'else' block of visible because
        // the parent controls visibility. We rely on the callback to tell parent to hide.
    }, [visible]);

    const handleHide = () => {
        // Animate Out (Slide Up)
        translateY.value = withTiming(-150, { duration: 500 }, (finished) => {
            if (finished) {
                runOnJS(onHide)();
            }
        });
    };

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateY: translateY.value }],
        };
    });

    const animatedProps = useAnimatedProps(() => ({
        strokeDashoffset: CIRCLE_LENGTH * (1 - progress.value),
    }));

    // If invisible and off-screen, don't render touch events
    if (!visible && translateY.value === -150) return null;

    return (
        <Animated.View style={[styles.container, animatedStyle, { top: 0 }]}>
            <View style={[styles.contentContainer, { borderColor: mainColor }]}>

                {/* Progress Circle Icon */}
                <View style={styles.iconContainer}>
                    <Svg width={44} height={44}>
                        {/* Background Circle */}
                        <Circle
                            cx={22}
                            cy={22}
                            r={CIRCLE_RADIUS}
                            stroke={mainColor}
                            strokeWidth={STROKE_WIDTH}
                            strokeOpacity={0.3}
                            fill="transparent"
                        />
                        {/* Animated Progress Circle */}
                        <AnimatedCircle
                            cx={22}
                            cy={22}
                            r={CIRCLE_RADIUS}
                            stroke={mainColor}
                            strokeWidth={STROKE_WIDTH}
                            fill="transparent"
                            strokeDasharray={CIRCLE_LENGTH}
                            strokeLinecap="round"
                            rotation="-90"
                            origin="22, 22"
                            animatedProps={animatedProps}
                        />
                    </Svg>
                    <View style={styles.centerIcon}>
                        <Ionicons
                            name={type === 'success' ? 'checkmark' : 'close'}
                            size={20}
                            color={mainColor}
                        />
                    </View>
                </View>

                {/* Text Content */}
                <View style={styles.textContainer}>
                    <Text style={styles.title}>{title}</Text>
                    <Text style={styles.message}>{message}</Text>
                </View>

            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 20,
        right: 20,
        alignItems: 'center',
        zIndex: 9999, // Ensure it's on top
    },
    contentContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1c1c1e',
        borderRadius: 16,
        padding: 12,
        width: '100%',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.30,
        shadowRadius: 4.65,
        elevation: 8,
        borderLeftWidth: 4,
    },
    iconContainer: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    centerIcon: {
        position: 'absolute',
    },
    textContainer: {
        flex: 1,
    },
    title: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    message: {
        color: '#ccc',
        fontSize: 14,
    },
});
