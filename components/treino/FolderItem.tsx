import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FichaMenuAction, FichaOptionsMenu } from '../../components/FichaOptionsMenu';
import { Folder } from '../../hooks/treino/types';

interface FolderItemProps {
    id: string;
    data: Folder;
    isExpanded?: boolean;
    isPrincipal?: boolean;
    onPress: (folderId: string) => void;
    onAction?: (action: FichaMenuAction, folderId: string) => void;
}

export function FolderItem({ id, data, isExpanded, isPrincipal, onPress, onAction }: FolderItemProps) {
    return (
        <View style={styles.folderWrapper}>
            <TouchableOpacity style={styles.folderCard} onPress={() => onPress(id)}>
                <View style={styles.folderInfo}>
                    <Ionicons name={isExpanded ? "arrow-up" : "arrow-down"} size={16} color="#555" />
                    <Text style={styles.folderName}>{data.nome}</Text>
                    {isPrincipal && <Text style={styles.principalTag}>principal</Text>}
                </View>
                {(data.type === 'ficha') && onAction && (
                    <FichaOptionsMenu
                        isPrincipal={!!isPrincipal}
                        onSelect={(action) => onAction(action, id)}
                    />
                )}
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    folderWrapper: {
        marginBottom: 0,
    },
    folderCard: {
        backgroundColor: 'transparent',
        paddingTop: 20,
        paddingBottom: 20,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 0.5,
        borderBottomColor: '#ffffff1a',
    },
    folderInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
    },
    folderName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    principalTag: {
        color: '#aaa',
        fontSize: 10,
        fontWeight: '300',
        marginLeft: 8,
        textTransform: 'lowercase',
    },
});
