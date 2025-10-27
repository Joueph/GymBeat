import * as Haptics from 'expo-haptics';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated'; // 1. Importar Animated

type OnboardingOptionProps = {
  icon: React.ReactNode;
  text: string;
  onPress: () => void;
  isSelected: boolean;
  entering?: any; // 2. Adicionar prop para receber animação de entrada
};

// 3. Criar um componente TouchableOpacity animado
const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

/**
 * Componente reutilizável para botões de seleção do Onboarding.
 * Inclui feedback tátil "Light" ao ser pressionado.
 * Agora aceita props de animação 'entering'.
 */
export const OnboardingOption: React.FC<OnboardingOptionProps> = ({
  icon,
  text,
  onPress,
  isSelected,
  entering, // 4. Receber a prop de animação
}) => {
  const handlePress = () => {
    // Feedback tátil "Low" (Light)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(); // This was correct, just confirming.
  };

  return (
    <AnimatedTouchableOpacity // 5. Usar o TouchableOpacity Animado
      style={[
        styles.container,
        isSelected ? styles.containerSelected : styles.containerDefault,
      ]}
      onPress={handlePress}
      entering={entering} // 6. Aplicar a animação de entrada
    >
      <View style={styles.iconContainer}>{icon}</View>
      <Text style={styles.text}>{text}</Text>
    </AnimatedTouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
    paddingVertical: 15, // Aumentado para mais altura
    borderRadius: 12, // Bordas mais arredondadas
    borderWidth: 1.5, // Borda um pouco mais espessa
    marginBottom: 12, // Espaçamento entre botões
    height: 60, // Altura fixa para consistência
  },
  containerDefault: {
    backgroundColor: '#1A1A1A', // Fundo escuro (quase preto)
    borderColor: '#2D2D2D', // Borda sutil
  },
  containerSelected: {
    backgroundColor: '#1C3F5F', // Cor de seleção (azul escuro do tema)
    borderColor: '#31A9FF', // Borda azul brilhante
  },
  iconContainer: {
    width: 40, // Largura fixa para o ícone
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 17, // Tamanho de fonte
    fontWeight: '600', // Um pouco mais de peso
  },
});
