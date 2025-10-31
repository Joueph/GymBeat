// app/components/SetOptionsMenu.tsx
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

// As opções que o seu modal espera
export type SetMenuAction = 'toggleTime' | 'addDropset' | 'copy' | 'delete';

interface SetOptionsMenuProps {
  onSelect: (action: SetMenuAction) => void;
  /** Passado para saber qual texto exibir (Usar Tempo / Usar Reps) */
  isTimeBased: boolean;
  /** Passado para saber se exibe as opções de 'toggleTime' e 'addDropset' */
  isNormalSet: boolean;
}

interface MenuOptionItemProps {
  text: string;
  icon: ComponentProps<typeof FontAwesome5>['name'];
  onSelect: () => void;
  isDestructive?: boolean;
}

/** Um helper interno para criar a linha com (Ícone + Texto) */
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

export const SetOptionsMenu = ({ onSelect, isTimeBased, isNormalSet }: SetOptionsMenuProps) => {
  return (
    <Menu onOpen={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}>
      {/* O ícone de 3 pontos que aciona o menu */}
      <MenuTrigger style={styles.trigger}>
        <FontAwesome5 name="ellipsis-v" size={20} color="#ccc" />
      </MenuTrigger>

      {/* As opções que aparecem no popover */}
      <MenuOptions customStyles={menuStyles}>
        {isNormalSet && (
          <>
            <MenuOptionItem
              text={isTimeBased ? 'Usar Reps' : 'Usar Tempo'}
              icon={isTimeBased ? 'redo-alt' : 'clock'} // Ícone dinâmico: 'redo-alt' para reps, 'clock' para tempo
              onSelect={() => onSelect('toggleTime')}
            />
            <MenuOptionItem
              text="Adicionar Dropset"
              icon="arrow-down" // Ícone de seta
              onSelect={() => onSelect('addDropset')}
            />
          </>
        )}

        {/* O divisor (só aparece se as opções acima existirem) */}
        {isNormalSet && <View style={styles.divider} />}

        <MenuOptionItem
          text="Copiar Série"
          icon="copy" // Ícone de copiar
          onSelect={() => onSelect('copy')}
        />
        <MenuOptionItem
          text="Deletar"
          icon="trash-alt" // Ícone de lixeira
          onSelect={() => onSelect('delete')}
          isDestructive
        />
      </MenuOptions>
    </Menu>
  );
};

// Estilos para o Popover (baseado na sua imagem)
const menuStyles = {
  optionsContainer: {
    backgroundColor: '#2c2c2e', // Fundo escuro
    borderRadius: 12,          // Cantos arredondados
    marginTop: 40,             // Deslocamento para baixo
    paddingVertical: 8,        // Espaçamento interno vertical
    width: 240,                // Largura (ajuste conforme preferir)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
};

// Estilos para os itens internos
const styles = StyleSheet.create({
  trigger: {
    padding: 10, // Área de toque
  },
  optionWrapper: {
    paddingHorizontal: 15,
    paddingVertical: 14, // Mais espaçado
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionIcon: {
    color: '#E0E0E0',
    marginRight: 15,
    width: 20, // Garante alinhamento dos textos
    textAlign: 'center',
  },
  optionText: {
    color: '#E0E0E0',
    fontSize: 16,
    fontWeight: '500',
  },
  destructiveText: {
    color: '#ff453a', // Vermelho para "Deletar"
  },
  divider: {
    height: 1,
    backgroundColor: '#444', // Cor do divisor
    marginVertical: 8,
    marginHorizontal: 15,
  },
});