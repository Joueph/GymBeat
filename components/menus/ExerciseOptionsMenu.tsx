
import { FontAwesome5 } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
    Menu,
    MenuOption,
    MenuOptions,
    MenuTrigger,
} from 'react-native-popup-menu';

export type ExerciseMenuAction = 'changeMachine' | 'editRestTime' | 'addNote' | 'advanced' | 'delete' | 'replace' | 'viewInfo' | 'reorder';

interface ExerciseOptionsMenuProps {
    onSelect: (action: ExerciseMenuAction) => void;
    // State flags can be passed here if dynamic menu items are needed
    // like showAdvanced={true} etc.
    showAdvanced?: boolean;
}

interface MenuOptionItemProps {
    text: string;
    icon: ComponentProps<typeof FontAwesome5>['name'];
    onSelect: () => void;
    isDestructive?: boolean;
}

const MenuOptionItem = ({ text, icon, onSelect, isDestructive = false }: MenuOptionItemProps) => (
    <MenuOption onSelect={onSelect} style={styles.optionWrapper}>
        <View style={styles.optionRow}>
            <FontAwesome5
                name={icon}
                size={16}
                style={[styles.optionIcon, isDestructive && styles.destructiveText]}
            />
            <Text style={[styles.optionText, isDestructive && styles.destructiveText]}>
                {text}
            </Text>
        </View>
    </MenuOption>
);

export const ExerciseOptionsMenu = ({ onSelect, showAdvanced = false }: ExerciseOptionsMenuProps) => {
    const handleOpen = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    return (
        <Menu onOpen={handleOpen}>
            <MenuTrigger style={styles.trigger}>
                <FontAwesome5 name="ellipsis-v" size={20} color="#ccc" />
            </MenuTrigger>

            <MenuOptions customStyles={menuStyles}>

                <MenuOptionItem
                    text="Selecionar Máquina"
                    icon="dumbbell"
                    onSelect={() => onSelect('changeMachine')}
                />



                <MenuOptionItem
                    text="Tempo de Descanso"
                    icon="clock"
                    onSelect={() => onSelect('editRestTime')}
                />

                <MenuOptionItem
                    text="Anotações"
                    icon="sticky-note" // or "pencil-alt" or "sticky-note"
                    onSelect={() => onSelect('addNote')}
                />

                {showAdvanced && (
                    <MenuOptionItem
                        text="Avançado"
                        icon="sliders-h"
                        onSelect={() => onSelect('advanced')}
                    />
                )}

                <View style={styles.divider} />

                <MenuOptionItem
                    text="Substituir Exercício"
                    icon="exchange-alt"
                    onSelect={() => onSelect('replace')}
                />

                <MenuOptionItem
                    text="Reordenar"
                    icon="sort"
                    onSelect={() => onSelect('reorder')}
                />

                <View style={styles.divider} />

                <MenuOptionItem
                    text="Remover Exercício"
                    icon="trash-alt"
                    onSelect={() => onSelect('delete')}
                    isDestructive
                />

            </MenuOptions>
        </Menu>
    );
};

const menuStyles = {
    optionsContainer: {
        backgroundColor: '#2A2E37',
        borderRadius: 12,
        paddingVertical: 8,
        marginTop: 40,
        width: 240,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 8,
        borderWidth: 1,
        borderTopColor: '#444',
        borderLeftColor: '#444',
        borderRightColor: '#4444444a',
        borderBottomColor: '#4444444a',
    },
};

const styles = StyleSheet.create({
    trigger: {
        padding: 10,
    },
    optionWrapper: {
        paddingHorizontal: 15,
        paddingVertical: 14,
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    optionIcon: {
        color: '#E0E0E0',
        marginRight: 15,
        width: 20,
        textAlign: 'center',
    },
    optionText: {
        color: '#E0E0E0',
        fontSize: 16,
        fontWeight: '500',
    },
    destructiveText: {
        color: '#ff3b30',
    },
    divider: {
        height: 1,
        backgroundColor: '#444',
        marginVertical: 8,
        marginHorizontal: 15,
    },
});
