import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Dimensions, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
    FadeInRight,
    FadeOutLeft,
    useAnimatedStyle,
    useSharedValue,
    withTiming
} from 'react-native-reanimated';

interface WalkthroughStep {
    id: string;
    title: string;
    description: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
}

const STEPS: WalkthroughStep[] = [
    {
        id: '1',
        title: 'Treinos Ilimitados',
        description: 'Acesse nossa biblioteca completa de treinos criados por especialistas e pela comunidade.',
        icon: 'barbell-outline',
        color: '#00ffcc'
    },
    {
        id: '2',
        title: 'Análise Avançada',
        description: 'Visualise seu progresso com gráficos detalhados de volume, carga e consistência.',
        icon: 'stats-chart-outline',
        color: '#1cb0f6'
    },
    {
        id: '3',
        title: 'Sem Limites',
        description: 'Crie quantas fichas quiser e personalize sua experiência ao máximo.',
        icon: 'infinite-outline',
        color: '#ffdd00'
    }
];

interface PremiumWalkthroughModalProps {
    visible: boolean;
    onComplete: () => void;
}

export function PremiumWalkthroughModal({ visible, onComplete }: PremiumWalkthroughModalProps) {
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const progress = useSharedValue(0);

    // Reset state when modal opens
    useEffect(() => {
        if (visible) {
            setCurrentStepIndex(0);
            progress.value = 0;
            // Start progress animation for first step
            progress.value = withTiming((1 / STEPS.length) * 100, { duration: 500 });
        }
    }, [visible]);

    const handleNext = () => {
        if (currentStepIndex < STEPS.length - 1) {
            const nextIndex = currentStepIndex + 1;
            setCurrentStepIndex(nextIndex);
            progress.value = withTiming(((nextIndex + 1) / STEPS.length) * 100, { duration: 400 });
        } else {
            onComplete();
        }
    };

    const currentStep = STEPS[currentStepIndex];

    const progressBarStyle = useAnimatedStyle(() => ({
        width: `${progress.value}%`
    }));

    // If not visible, return null (but Modal handles visibility too)
    // We keep it rendered for transition logic if needed, but Modal prop does the job.

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            statusBarTranslucent={true}
        >
            <View style={styles.container}>
                <View style={styles.contentCard}>
                    {/* Header: Progress Bar */}
                    <View style={styles.progressContainer}>
                        <Animated.View style={[styles.progressBar, progressBarStyle]} />
                    </View>

                    {/* Content Section */}
                    {/* We use keys to force re-render/animation on step change */}
                    <Animated.View
                        key={currentStep.id}
                        entering={FadeInRight.duration(400)}
                        exiting={FadeOutLeft.duration(200)}
                        style={styles.stepContent}
                    >
                        <View style={[styles.iconContainer, { backgroundColor: `${currentStep.color}20` }]}>
                            <Ionicons name={currentStep.icon} size={80} color={currentStep.color} />
                        </View>

                        <Text style={styles.title}>{currentStep.title}</Text>
                        <Text style={styles.description}>{currentStep.description}</Text>
                    </Animated.View>

                    {/* Footer: Button */}
                    <TouchableOpacity
                        style={styles.button}
                        onPress={handleNext}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.buttonText}>
                            {currentStepIndex === STEPS.length - 1 ? "Começar Agora" : "Próximo"}
                        </Text>
                        <Ionicons
                            name="arrow-forward"
                            size={20}
                            color="#000"
                            style={{ marginLeft: 8 }}
                        />
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    contentCard: {
        width: '100%',
        maxWidth: 400,
        backgroundColor: '#1E1E1E',
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: '#333',
        minHeight: 450, // Fixed height for consistency
        justifyContent: 'space-between',
    },
    progressContainer: {
        height: 6,
        backgroundColor: '#333',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 40,
    },
    progressBar: {
        height: '100%',
        backgroundColor: '#00ffcc',
        borderRadius: 3,
    },
    stepContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 10,
    },
    iconContainer: {
        width: 140,
        height: 140,
        borderRadius: 70,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 30,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 16,
        textAlign: 'center',
    },
    description: {
        fontSize: 16,
        color: '#ccc',
        textAlign: 'center',
        lineHeight: 24,
        paddingHorizontal: 10,
    },
    button: {
        backgroundColor: '#fff',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 18,
        borderRadius: 16,
        marginTop: 40,
        shadowColor: '#fff',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
    },
    buttonText: {
        color: '#000',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
