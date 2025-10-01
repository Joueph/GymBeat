import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, TouchableOpacity, View, ViewProps } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';


interface AnimatedGradientBorderButtonProps extends ViewProps {
  onPress: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}

export default function AnimatedGradientBorderButton({ onPress, disabled, children, ...props }: AnimatedGradientBorderButtonProps) {
  const rotation = useSharedValue(0);
  // 1. Estado para armazenar as dimensões do botão
  const [buttonSize, setButtonSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, {
        duration: 4000,
        easing: Easing.linear,
      }),
      -1,
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

  // 2. Handler para capturar o tamanho do botão quando ele for renderizado
  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setButtonSize({ width, height });
  };

  // 3. Calcula o tamanho que o plano giratório precisa ter (a diagonal do botão)
  const diagonal = Math.sqrt(Math.pow(buttonSize.width, 2) + Math.pow(buttonSize.height, 2));

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={styles.container}
      onLayout={handleLayout}
    >
      {/* O resto do JSX continua exatamente o mesmo */}
      {buttonSize.width > 0 && (
        <Animated.View
          style={[
            styles.gradientWrapper,
            {
              width: diagonal,
              height: diagonal,
              marginTop: -(diagonal / 2),
              marginLeft: -(diagonal / 2),
            },
            animatedStyle,
          ]}
        >
          <LinearGradient
            colors={['#ffffff00', '#A0E9FF', '#ffffff00']}
            locations={[0.45, 0.5, 0.55]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ width: '100%', height: '100%' }}
          />
        </Animated.View>
      )}

      <View style={styles.innerContent}>
        {children}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ffffff1a',
  },
  gradientWrapper: {
    position: 'absolute',
    top: '50%',
    left: '50%',
  },
  innerContent: {
    backgroundColor: '#141414',
    padding: 15,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
});