import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  Platform,
  type TextInputProps,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { EyeIcon, EyeOffIcon } from './FinanceIcons';

export interface FinanceInputProps extends TextInputProps {
  label: string;
  error?: string;
  leftIcon?: React.ReactNode;
  isPassword?: boolean;
}

export const FinanceInput: React.FC<FinanceInputProps> = ({
  label,
  error,
  leftIcon,
  isPassword = false,
  value,
  style,
  ...props
}) => {
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [hidePassword, setHidePassword] = useState(isPassword);

  const primaryBlue = '#2563EB';
  const hoverBlue = '#60A5FA';
  const borderColor = error
    ? '#DC2626'
    : isFocused
    ? primaryBlue
    : isHovered
    ? hoverBlue
    : '#334155';

  const backgroundColor = '#1E293B';
  const labelColor = error
    ? '#DC2626'
    : isFocused
    ? hoverBlue
    : '#94A3B8';

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, { color: labelColor }]}>{label}</Text>

      <View
        onTouchEnd={() => inputRef.current?.focus()}
        style={[
          styles.container,
          {
            backgroundColor,
            borderColor,
          },
          Platform.OS === 'web'
            ? ({
                outlineWidth: 0,
                WebkitTapHighlightColor: 'transparent',
                cursor: 'text',
              } as unknown as ViewStyle)
            : null,
        ]}>
        {leftIcon && <View style={styles.leftIconWrapper}>{leftIcon}</View>}

        <TextInput
          ref={inputRef}
          {...props}
          value={value}
          style={[
            styles.input,
            {
              color: '#F8FAFC',
            },
            Platform.OS === 'web'
              ? ({
                  outlineWidth: 0,
                  WebkitTapHighlightColor: 'transparent',
                } as unknown as TextStyle)
              : null,
            style,
          ]}
          placeholderTextColor="#64748B"
          secureTextEntry={isPassword ? hidePassword : props.secureTextEntry}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          selectionColor={primaryBlue}
          autoCapitalize={isPassword ? 'none' : props.autoCapitalize}
          autoCorrect={isPassword ? false : props.autoCorrect}
        />

        {isPassword && (
          <TouchableOpacity
            testID="toggle-password-visibility"
            style={styles.rightIconButton}
            onPress={() => setHidePassword((prev) => !prev)}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            {hidePassword ? (
              <EyeOffIcon size={22} color="#94A3B8" />
            ) : (
              <EyeIcon size={22} color={hoverBlue} />
            )}
          </TouchableOpacity>
        )}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 20,
    width: '100%',
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    height: 54,
  },
  leftIconWrapper: {
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  rightIconButton: {
    marginLeft: 8,
    padding: 4,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 6,
  },
});