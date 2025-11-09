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

export type FichaMenuAction = 'set-active' | 'rename' | 'share' | 'delete';

interface FichaOptionsMenuProps {
  onSelect: (action: FichaMenuAction) => void;
  isPrincipal: boolean;
}

interface MenuOptionItemProps {
  text: string;
  icon: ComponentProps<typeof FontAwesome5>['name'];
  onSelect: () => void;
  isDestructive?: boolean;
  disabled?: boolean;
}

const MenuOptionItem = ({ text, icon, onSelect, isDestructive = false, disabled = false }: MenuOptionItemProps) => (
  <MenuOption onSelect={onSelect} style={styles.optionWrapper} disabled={disabled}>
    <View style={styles.optionRow}>
      <FontAwesome5
        name={icon}
        size={16}
        style={[styles.optionIcon, isDestructive && styles.destructiveText, disabled && styles.disabledText]}
      />
      <Text style={[styles.optionText, isDestructive && styles.destructiveText, disabled && styles.disabledText]}>
        {text}
      </Text>
    </View>
  </MenuOption>
);

export const FichaOptionsMenu = ({ onSelect, isPrincipal }: FichaOptionsMenuProps) => {
  return (
    <Menu onOpen={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}>
      <MenuTrigger style={styles.trigger}>
        <FontAwesome5 name="ellipsis-v" size={16} color="#555" />
      </MenuTrigger>

      <MenuOptions customStyles={menuStyles}>
        <MenuOptionItem
          text={isPrincipal ? "Já é a ficha principal" : "Definir como principal"}
          icon="star"
          onSelect={() => onSelect('set-active')}
          disabled={isPrincipal}
        />
        <View style={styles.divider} />
        <MenuOptionItem
          text="Alterar o nome da ficha"
          icon="pencil-alt"
          onSelect={() => onSelect('rename')}
        />
        <MenuOptionItem
          text="Compartilhar"
          icon="share-alt"
          onSelect={() => onSelect('share')}
        />
        <View style={styles.divider} />
        <MenuOptionItem
          text="Deletar ficha"
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
    backgroundColor: '#1A1D23',
    borderRadius: 12,
    paddingVertical: 8,
    marginTop: 30,
    width: 260,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#444',
  },
};

const styles = StyleSheet.create({
  trigger: { padding: 10 },
  optionWrapper: { paddingHorizontal: 15, paddingVertical: 14 },
  optionRow: { flexDirection: 'row', alignItems: 'center' },
  optionIcon: { color: '#E0E0E0', marginRight: 15, width: 20, textAlign: 'center' },
  optionText: { color: '#E0E0E0', fontSize: 16, fontWeight: '500' },
  destructiveText: { color: '#ff453a' },
  disabledText: { color: '#666' },
  divider: { height: 1, backgroundColor: '#444', marginVertical: 8, marginHorizontal: 15 },
});