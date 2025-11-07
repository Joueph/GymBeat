import React, { useEffect } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  SlideInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated';

type Ficha = {
  id: string;
  nome: string;
};

type FichaSelectorModalProps = {
  fichas: Ficha[];
  activeFicha: Ficha | null;
  onSetFichaAtiva: (id: string) => void;
  onClose: () => void;
  position: { x: number; y: number; width: number; height: number };
};

const FichaSelectorModal: React.FC<FichaSelectorModalProps> = ({
  fichas,
  activeFicha,
  onSetFichaAtiva,
  onClose,
  position,
}) => {
  const animation = useSharedValue(0);

  useEffect(() => {
    animation.value = withTiming(1, { duration: 300 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      top: position.y,
      left: position.x,
      width: position.width,
    };
  });

  const contentOpacityStyle = useAnimatedStyle(() => {
    return {
      opacity: animation.value,
    };
  });

  const nonActiveFichas = fichas.filter((f: Ficha) => f.id !== activeFicha?.id);

  return (
    // ...
          <View style={styles.otherFichasContainer}>
            <FlatList
              data={nonActiveFichas}
              keyExtractor={(item) => item.id}
              renderItem={({ item, index }) => (
                <Animated.View entering={SlideInDown.duration(300).delay(100 + index * 50).springify().damping(18)}>
                  <TouchableOpacity
                    style={styles.fichaItem}
                    onPress={() => onSetFichaAtiva(item.id)}
                  >
                    <Text style={styles.fichaItemText}>{item.nome}</Text>
                  </TouchableOpacity>
                </Animated.View>
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          </View>
    // ...
  );
};

const styles = StyleSheet.create({
  blurContainer: {
    flex: 1,
  },
  container: {
    position: 'absolute',
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    overflow: 'hidden',
    borderColor: '#ffffff2a',
    borderWidth: 1,
  },
  activeFichaItem: {
    backgroundColor: '#141414',
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  otherFichasContainer: {
    flex: 1,
    paddingHorizontal: 15,
  },
  fichaItem: {
    paddingVertical: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fichaItemText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  separator: {
    height: 1,
    backgroundColor: '#2c2c2e',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2c2c2e',
    padding: 15,
    margin: 15,
    borderRadius: 8,
  },
  editButtonText: {
    color: '#fff',
    marginLeft: 8,
    fontWeight: 'bold',
  },
});

export default FichaSelectorModal;