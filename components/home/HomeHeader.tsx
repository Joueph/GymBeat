import { ConfigIcon } from '@/app/icon/ConfigIcon'; // Assuming this import path works or will be adjusted
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type HomeHeaderProps = {
    onOpenUpvote: () => void;
    onOpenSettings: () => void;
    onOpenLayoutConfig: () => void;
};

export const HomeHeader: React.FC<HomeHeaderProps> = ({ onOpenUpvote, onOpenSettings, onOpenLayoutConfig }) => {
    return (
        <View style={styles.headerContainer}>
            <Text style={styles.headerTitle}>Progresso</Text>
            <View style={styles.headerActions}>
                <TouchableOpacity style={styles.framedConfigButton} onPress={onOpenLayoutConfig}>
                    <Ionicons name="grid-outline" size={16} color="#EAEAEA" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.framedConfigButton} onPress={onOpenUpvote}>
                    <Ionicons name="arrow-up" size={16} color="#EAEAEA" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.framedConfigButton} onPress={onOpenSettings}>
                    <ConfigIcon width={16} height={16} rotation={90} />
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    headerContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    framedConfigButton: { backgroundColor: '#141414', borderRadius: 110, borderColor: '#ffffff1a', borderWidth: 0.5, width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { color: '#EAEAEA', fontSize: 40, fontWeight: 'bold' },
});
