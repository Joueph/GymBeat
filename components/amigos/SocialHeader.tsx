
import { FontAwesome } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface SocialHeaderProps {
    onNotificationsPress: () => void;
    onAddFriendPress: () => void;
    pendingNotificationCount?: number;
}

export function SocialHeader({ onNotificationsPress, onAddFriendPress, pendingNotificationCount = 0 }: SocialHeaderProps) {
    return (
        <View style={styles.headerContainer}>
            <Text style={styles.headerTitle}>Social</Text>
            <View style={styles.headerActions}>
                <TouchableOpacity onPress={onNotificationsPress} style={styles.headerButton}>
                    <View>
                        <FontAwesome name="bell" size={20} color="#fff" />
                        {pendingNotificationCount > 0 && (
                            <View style={{
                                position: 'absolute',
                                right: -2,
                                top: -2,
                                backgroundColor: '#EF4444',
                                borderRadius: 5,
                                width: 10,
                                height: 10,
                                borderWidth: 1,
                                borderColor: '#1A1D23',
                            }} />
                        )}
                    </View>
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
