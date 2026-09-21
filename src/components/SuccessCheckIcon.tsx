import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

export interface SuccessCheckIconProps {
  size?: number;
}

export const SuccessCheckIcon: React.FC<SuccessCheckIconProps> = ({ size = 72 }) => {
  const haloSize = size + 18;
  const haloBorderRadius = haloSize / 2;

  return (
    <View style={[styles.container, { width: haloSize, height: haloSize }]}>
      <View
        style={[
          styles.glowHalo,
          {
            width: haloSize,
            height: haloSize,
            borderRadius: haloBorderRadius,
          },
        ]}
      />
      <Svg width={size} height={size} viewBox="0 0 72 72" fill="none">
        <Circle cx="36" cy="36" r="34" fill="#4ADE80" />
        <Path
          d="M24 36.5L32.5 45L48.5 27.5"
          stroke="#FFFFFF"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  glowHalo: {
    position: 'absolute',
    backgroundColor: 'rgba(74, 222, 128, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.28)',
  },
});
