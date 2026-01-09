import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Usuario } from '../../models/usuario';

interface PerfilCardProps {
    user: Usuario | null;
    friendsCount: number;
    workoutsCount: number;
    totalVolume: number;
}

export const PerfilCard = ({ user, friendsCount, workoutsCount, totalVolume }: PerfilCardProps) => {
    const router = useRouter();

    return (
        <View style={styles.userProfileCard}>
            <TouchableOpacity onPress={() => router.push('/perfil')}>
                <TouchableOpacity style={styles.editProfileButton} onPress={() => router.push('/perfil')}>
                    <FontAwesome name="pencil" size={16} color="#ccc" />
                </TouchableOpacity>
                <View style={styles.userProfileInfo}>
                    {user?.photoURL ? (
                        <Image source={{ uri: user.photoURL }} style={styles.userPfp} />
                    ) : (
                        <View style={styles.userPfpPlaceholder}><FontAwesome name="user" size={24} color="#555" /></View>
                    )}
                    <View>
                        <Text style={styles.userName}>{user?.nome}</Text>
                        <Text style={styles.userEmail}>{user?.email}</Text>
                    </View>
                </View>
            </TouchableOpacity>
            <View style={styles.userStatsContainer}>
                <View style={styles.statItem}><Text style={styles.statValue}>{friendsCount}</Text><Text style={styles.statLabel}>Amigos</Text></View>
                <View style={styles.statItem}><Text style={styles.statValue}>{workoutsCount}</Text><Text style={styles.statLabel}>Treinos</Text></View>
                <View style={styles.statItem}><Text style={styles.statValue}>{totalVolume > 1000 ? `${(totalVolume / 1000).toFixed(1)}t` : `${Math.round(totalVolume)}kg`}</Text><Text style={styles.statLabel}>Volume Total</Text></View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    userProfileCard: {
        backgroundColor: '#1A1D23',
        borderRadius: 12,
        marginHorizontal: 16,
        marginBottom: 20,
        paddingTop: 15,
        paddingHorizontal: 15,
        borderWidth: 1,
        borderColor: '#ffffff1a',
    },
    editProfileButton: {
        position: 'absolute',
        top: 10,
        right: 10,
        padding: 5,
    },
    userProfileInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    userPfp: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 15,
    },
    userPfpPlaceholder: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#0B0D10',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    userName: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    userEmail: {
        color: '#aaa',
        fontSize: 14,
    },
    userStatsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        borderTopWidth: 1,
        borderTopColor: '#ffffff1a',
        marginTop: 15,
        paddingTop: 15,
        paddingBottom: 5,
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statValue: {
        color: '#fff',
        fontSize: 22,
        fontWeight: 'bold',
    },
    statLabel: {
        color: '#aaa',
        fontSize: 12,
        marginTop: 4,
    },
});
