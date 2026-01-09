import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Dimensions, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Projeto } from '../../models/projeto';

interface ProjetosSectionProps {
    projetos: Projeto[];
    onAddProjectPress: () => void;
}

const cardWidth = Dimensions.get('window').width * 0.9;

export const ProjetosSection = ({ projetos, onAddProjectPress }: ProjetosSectionProps) => {
    const router = useRouter();

    return (
        <View style={styles.section}>
            <Text style={styles.mainSectionTitle}>Meus Projetos</Text>
            <FlatList
                data={[...projetos, { id: 'add' }]}
                renderItem={({ item }: { item: Projeto | { id: 'add' } }) => {
                    if ('titulo' in item) {
                        return (
                            <TouchableOpacity style={styles.projetoCard} onPress={() => router.push(`/(projetos)/${item.id}`)}>
                                <Image source={{ uri: item.fotoCapa || 'https://via.placeholder.com/350x150.png/141414/808080?text=Projeto' }} style={styles.projetoCardImage} />
                                <View style={styles.projetoCardOverlay} />
                                <View style={styles.projetoCardContent}>
                                    <Text style={styles.projetoCardTitle} numberOfLines={2}>{item.titulo}</Text>
                                    <View style={styles.projetoCardInfo}>
                                        <View style={styles.infoItem}><FontAwesome name="users" size={14} color="#fff" /><Text style={styles.infoText}>{item.participantes?.length || 0}</Text></View>
                                        <View style={styles.infoItem}><FontAwesome name="fire" size={14} color="#DAA520" /><Text style={styles.infoText}>{item.semanasSeguidas || 0}</Text></View>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    } else {
                        return (
                            <TouchableOpacity style={styles.createProjetoCard} onPress={onAddProjectPress}>
                                <FontAwesome name="plus" size={30} color="#888" />
                            </TouchableOpacity>
                        );
                    }
                }}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingLeft: 8, paddingVertical: 10 }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    section: {
        marginBottom: 15,
    },
    mainSectionTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 20,
        marginTop: 10,
    },
    projetoCard: {
        width: cardWidth,
        height: 150,
        borderRadius: 12,
        marginRight: 15,
        backgroundColor: '#1A1D23',
        justifyContent: 'flex-end',
        overflow: 'hidden',
    },
    projetoCardImage: {
        ...StyleSheet.absoluteFillObject,
    },
    projetoCardOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    projetoCardContent: {
        padding: 12,
    },
    projetoCardTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    projetoCardInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    infoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    infoText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
    createProjetoCard: {
        width: 120,
        height: 150,
        borderRadius: 12,
        marginRight: 15,
        backgroundColor: '#1A1D23',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#222',
        borderStyle: 'dashed',
    },
});
