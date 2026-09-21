import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { LinearGradient } from 'expo-linear-gradient';

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
          <Text style={{ fontSize: size * 0.7, color }}>👤</Text>
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
          <Text style={{ fontSize: size * 0.7, color }}>🔒</Text>
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
          <Text style={{ fontSize: size * 0.7, color }}>👁</Text>
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
          <Text style={{ fontSize: size * 0.7, color }}>👁‍🗨</Text>
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
          <Text style={{ fontSize: size * 0.7, color }}>👆</Text>
        </View>
      }
    />
  );
};

import Logo from '@/assets/images/logo.svg';

export const AppLogoIcon: React.FC<{ size?: number }> = ({ size = 64 }) => {
  return (
    <LinearGradient
      colors={['#60A5FA', '#1D4ED8']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.logoContainer,
        { width: size, height: size, borderRadius: size / 2 },
      ]}>
      <Logo width={size * 0.58} height={size * 0.58} />
    </LinearGradient>
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
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
});