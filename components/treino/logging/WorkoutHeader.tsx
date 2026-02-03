import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface WorkoutHeaderProps {
    workoutName: string;
    setWorkoutName: (name: string) => void;
    setIsNameEdited: (edited: boolean) => void;
    handleBack: () => void;
    handleFinishWorkout: () => void;
    isFinishing: boolean;
    allSeriesCompleted: boolean;
    onTitlePress: () => void;
    isNameEdited: boolean;
}

export const WorkoutHeader = ({
    workoutName,
    setWorkoutName,
    setIsNameEdited,
    handleBack,
    handleFinishWorkout,
    isFinishing,
    allSeriesCompleted,
    onTitlePress,
    isNameEdited
}: WorkoutHeaderProps) => {
    return (
        <View style={styles.customHeader}>
            <View style={styles.headerLeftGroup}>
                <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={28} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity onPress={onTitlePress} style={{ flex: 1 }}>
                    <TextInput
                        style={styles.headerTitleInput}
                        value={workoutName}
                        placeholder="Nome do Treino"
                        placeholderTextColor="#888"
                        onChangeText={(text) => {
                            setWorkoutName(String(text));
                            if (!isNameEdited) {
                                setIsNameEdited(true);
                            }
                        }}
                    />
                </TouchableOpacity>
            </View>
            <View style={styles.headerRightContainer}>
                {isFinishing ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <TouchableOpacity
                        onPress={handleFinishWorkout}
                        style={[
                            styles.finishButton,
                            allSeriesCompleted && styles.finishButtonCompleted,
                        ]}
                    >
                        <Text
                            style={[
                                styles.finishButtonText,
                                allSeriesCompleted && styles.finishButtonTextCompleted,
                            ]}
                        >
                            Finalizar
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    headerRightContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerLeftGroup: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
    },
    backButton: {
        gap: 10,
    },
    customHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingBottom: 10,
    },
    headerTitleInput: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        flex: 1,
    },
    finishButton: {
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#3B82F6',
    },
    finishButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    finishButtonCompleted: {
        backgroundColor: '#3B82F6',
    },
    finishButtonTextCompleted: {
        color: '#fff',
    },
});
