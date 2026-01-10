
import { FontAwesome } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface SocialHeaderProps {
    onNotificationsPress: () => void;
    onAddFriendPress: () => void;
}

export function SocialHeader({ onNotificationsPress, onAddFriendPress }: SocialHeaderProps) {
    return (
        <View style={styles.headerContainer}>
            <Text style={styles.headerTitle}>Social</Text>
            <View style={styles.headerActions}>
                <TouchableOpacity onPress={onNotificationsPress} style={styles.headerButton}>
                    <FontAwesome name="bell" size={20} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity onPress={onAddFriendPress} style={styles.headerButton}>
                    <FontAwesome name="user-plus" size={20} color="#fff" />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    headerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: '15%',
        marginBottom: 10,
    },
    headerTitle: {
        color: '#FBFBFB',
        fontSize: 40,
        fontWeight: 'bold',
    },
    headerActions: {
        flexDirection: 'row',
        gap: 15,
    },
    headerButton: {
        padding: 8,
    },
});
