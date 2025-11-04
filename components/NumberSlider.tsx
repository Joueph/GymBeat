// components/NumberSlider.tsx
import * as Haptics from "expo-haptics";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { FlatList, LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, StyleSheet, Text, View } from "react-native";

interface NumberSliderProps {
  min: number;
  max: number;
  value: number;
  onChange: (val: number) => void;
  vertical?: boolean;
  step?: number;
  initialValue?: number;
  displayValues?: string[];
  fontSizeConfig?: { selected: number; unselected: number };
  validRange?: { min: number; max: number }; // NOVO: Para controlar a opacidade
}

export const NumberSlider: React.FC<NumberSliderProps> = ({
  min,
  max,
  value,
  onChange,
  vertical = false,
  step = 1,
  initialValue,
  displayValues,
  fontSizeConfig = { selected: 36, unselected: 20 }, // Valores padrão
  validRange, // NOVO
}) => {
  const flatListRef = useRef<FlatList>(null);
  const itemSize = 60; // Tamanho de cada item do slider

  // Estado para armazenar a dimensão (largura ou altura) da FlatList
  const [listDimension, setListDimension] = useState(0);

  const data = useMemo(
    () => Array.from({ length: (max - min) / step + 1 }, (_, i) => min + i * step),
    [min, max, step]
  );

  // Calcula o padding necessário para centralizar o primeiro e o último item
  const contentContainerPadding = useMemo(() => {
    return listDimension ? (listDimension - itemSize) / 2 : 0;
  }, [listDimension, itemSize]);

  // Função para capturar a dimensão da FlatList quando ela é renderizada
  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setListDimension(vertical ? height : width);
  };

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = vertical ? e.nativeEvent.contentOffset.y : e.nativeEvent.contentOffset.x;
      const index = Math.round(offset / itemSize);
      const newValue = data[index];
  
      if (newValue !== value && newValue !== undefined) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onChange(newValue);
      }
    },
    [data, onChange, value, vertical, itemSize]
  );

  const initialIndex = initialValue !== undefined ? data.indexOf(initialValue) : data.indexOf(value);
  const getItemLayout = (_: any, index: number) => ({ length: itemSize, offset: itemSize * index, index });

  return (
    <View
      style={[
        styles.container,
        vertical ? styles.verticalContainer : styles.horizontalContainer,
      ]}
    >
      <FlatList
        ref={flatListRef}
        data={data}
        onLayout={handleLayout} // Adicionado para obter as dimensões
        keyExtractor={(item) => item.toString()}
        horizontal={!vertical}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        snapToInterval={itemSize}
        decelerationRate="fast"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        initialScrollIndex={initialIndex !== -1 ? initialIndex : 0}
        getItemLayout={getItemLayout}
        // Padding dinâmico para centralização
        contentContainerStyle={{
          paddingVertical: vertical ? contentContainerPadding : 0,
          paddingHorizontal: !vertical ? contentContainerPadding : 0,
        }}
        renderItem={({ item }) => {
          const isSelected = item === value;
          // NOVO: Verifica se o item está dentro do range válido, se houver
          const isValid = !validRange || (item >= validRange.min && item <= validRange.max);

          const distance = Math.abs(item - value);
          // AJUSTE: Fontes menores
          const fontSize = isSelected ? fontSizeConfig.selected : fontSizeConfig.unselected;
          // AJUSTE: Usa a validade para definir a opacidade
          const baseOpacity = isSelected ? 1 : Math.max(0.2, 1 - (distance / (vertical ? 5 : 3)));
          const opacity = isValid ? baseOpacity : 0.25;

          const scale = isSelected ? 1 : Math.max(0.6, 1 - (distance / (vertical ? 10 : 5)));
          const color = isSelected ? "#fff" : `rgba(255, 255, 255, ${opacity})`;
          const displayItem = displayValues ? displayValues[item - 1] : String(item);

          return (
            <View style={[ styles.item, vertical ? { height: itemSize } : { width: itemSize } ]}>
              <Text style={[styles.text, { color, fontSize, transform: [{ scale }] }]}>
                {displayItem}
              </Text>
            </View>
          );
        }}
      />
      {/* AJUSTE: Linhas separadoras para sliders verticais */}
      {vertical && (
        <>
          <View style={[styles.separator, { top: '50%', marginTop: -(itemSize / 2) - 1 }]} />
          <View style={[styles.separator, { top: '50%', marginTop: (itemSize / 2) }]} />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  verticalContainer: { height: 300 }, // Altura reduzida para um visual mais compacto
  horizontalContainer: { width: "100%", height: 100, paddingHorizontal: 10 }, // Adicionado padding para evitar cortes
  item: {
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    // fontSize: 28, // Agora é dinâmico
    fontWeight: "bold",
    textAlign: 'center',
  },
  separator: {
    position: 'absolute',
    left: '10%',
    right: '10%',
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
});