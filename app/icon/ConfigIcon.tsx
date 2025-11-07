import React from 'react';
import Svg, { Circle, G, Line } from 'react-native-svg';

export const ConfigIcon = ({ width = 22, height = 22, color = '#FBFBFB' }) => (
  <Svg width={width} height={height} viewBox="0 0 13 12" fill="none">
    <G opacity="0.75">
      <Circle cx="2.842" cy="2.842" r="2.842" fill={color} />
      <Circle cx="9.79" cy="9.158" r="2.211" stroke={color} strokeWidth="1.263" />
      <Line x1="0" y1="2.842" x2="12" y2="2.842" stroke={color} strokeWidth="0.632" />
      <Line x1="8.21" y1="9.158" x2="0" y2="9.158" stroke={color} strokeWidth="0.632" />
    </G>
  </Svg>
);