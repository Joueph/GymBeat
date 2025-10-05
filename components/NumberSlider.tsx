// components/NumberSlider.tsx
import * as Haptics from "expo-haptics";
import React, { useCallback, useMemo, useState } from "react";
import { FlatList, LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, StyleSheet, Text, View } from "react-native";

interface NumberSliderProps {
  min: number;
  max: number;
  value: number;
  onChange: (val: number) => void;
  vertical?: boolean;
  step?: number;
}

export const NumberSlider: React.FC<NumberSliderProps> = ({
  min,
  max,
  value,
  onChange,
  vertical = false,
  step = 1,
}) => {
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
        Haptics.selectionAsync();
        onChange(newValue);
      }
    },
    [data, onChange, value, vertical, itemSize]
  );

  const initialIndex = data.indexOf(value);
  const getItemLayout = (_: any, index: number) => ({ length: itemSize, offset: itemSize * index, index });

  return (
    <View
      style={[
        styles.container,
        vertical ? styles.verticalContainer : styles.horizontalContainer,
      ]}
    >
      <FlatList
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
          const distance = Math.abs(item - value);
          const isSelected = distance === 0;
          const opacity = isSelected ? 1 : Math.max(0.3, 1 - distance / 10);
          const color = isSelected ? "#1cb0f6" : `rgba(255, 255, 255, ${opacity.toFixed(2)})`;

          return (
            <View
              style={[
                styles.item,
                vertical ? { height: itemSize } : { width: itemSize },
              ]}
            >
              <Text style={[styles.text, { color }]}>
                {item}
              </Text>
            </View>
          );
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  verticalContainer: { height: 400 }, // Aumentado para melhor visualização
  horizontalContainer: { width: "100%", height: 100 },
  item: {
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontSize: 28,
    fontWeight: "bold",
  },
});