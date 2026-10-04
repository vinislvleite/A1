import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { Feather } from '@expo/vector-icons';

interface IconProps {
  size?: number;
  color?: string;
}

export const UserIcon: React.FC<IconProps> = ({ size = 20, color = '#64748B' }) => {
  return (
    <SymbolView
      name={{
        ios: 'person.fill',
        android: 'person',
        web: 'person',
      }}
      size={size}
      tintColor={color}
      style={{ width: size, height: size }}
      fallback={
        <View style={[styles.fallbackBox, { width: size, height: size }]}>
          <Feather name="user" size={size} color={color} />
        </View>
      }
    />
  );
};

export const LockIcon: React.FC<IconProps> = ({ size = 20, color = '#64748B' }) => {
  return (
    <SymbolView
      name={{
        ios: 'lock.fill',
        android: 'lock',
        web: 'lock',
      }}
      size={size}
      tintColor={color}
      style={{ width: size, height: size }}
      fallback={
        <View style={[styles.fallbackBox, { width: size, height: size }]}>
          <Feather name="lock" size={size} color={color} />
        </View>
      }
    />
  );
};

export const EyeIcon: React.FC<IconProps> = ({ size = 20, color = '#64748B' }) => {
  return (
    <SymbolView
      name={{
        ios: 'eye.fill',
        android: 'visibility',
        web: 'visibility',
      }}
      size={size}
      tintColor={color}
      style={{ width: size, height: size }}
      fallback={
        <View style={[styles.fallbackBox, { width: size, height: size }]}>
          <Feather name="eye" size={size} color={color} />
        </View>
      }
    />
  );
};

export const EyeOffIcon: React.FC<IconProps> = ({ size = 20, color = '#64748B' }) => {
  return (
    <SymbolView
      name={{
        ios: 'eye.slash.fill',
        android: 'visibility_off',
        web: 'visibility_off',
      }}
      size={size}
      tintColor={color}
      style={{ width: size, height: size }}
      fallback={
        <View style={[styles.fallbackBox, { width: size, height: size }]}>
          <Feather name="eye-off" size={size} color={color} />
        </View>
      }
    />
  );
};

export const FingerprintIcon: React.FC<IconProps> = ({ size = 24, color = '#2563EB' }) => {
  return (
    <SymbolView
      name={{
        ios: 'touchid',
        android: 'fingerprint',
        web: 'fingerprint',
      }}
      size={size}
      tintColor={color}
      style={{ width: size, height: size }}
      fallback={
        <View style={[styles.fallbackBox, { width: size, height: size }]}>
          <Feather name="shield" size={size} color={color} />
        </View>
      }
    />
  );
};

export const AppLogoIcon: React.FC<{ size?: number; borderRadius?: number }> = ({
  size = 72,
  borderRadius = 18,
}) => {
  return (
    <View
      style={[
        styles.logoContainer,
        {
          width: size,
          height: size,
          borderRadius,
        },
      ]}>
      <Image
        source={require('@/assets/images/icon.png')}
        style={{ width: size, height: size, borderRadius }}
        resizeMode="contain"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  fallbackBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});