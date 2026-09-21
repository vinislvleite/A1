import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  useColorScheme,
  type TouchableOpacityProps,
  type ViewStyle,
  type TextStyle,
} from 'react-native';

export interface FinanceButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline';
  loading?: boolean;
  leftIcon?: React.ReactNode;
  buttonStyle?: ViewStyle;
  textStyle?: TextStyle;
}

export const FinanceButton: React.FC<FinanceButtonProps> = ({
  title,
  variant = 'primary',
  loading = false,
  leftIcon,
  buttonStyle,
  textStyle,
  disabled,
  style,
  ...props
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const isDisabled = disabled || loading;

  const getContainerStyle = (): ViewStyle => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: isDisabled ? '#334155' : '#2563EB',
          borderColor: 'transparent',
        };
      case 'secondary':
        return {
          backgroundColor: '#1D4ED8',
          borderColor: 'transparent',
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor: '#2563EB',
        };
      default:
        return {};
    }
  };

  const getTextColor = (): string => {
    if (isDisabled) {
      return '#5C5C66';
    }
    switch (variant) {
      case 'primary':
        return '#FFFFFF';
      case 'secondary':
        return '#FFFFFF';
      case 'outline':
        return '#60A5FA';
      default:
        return '#FFFFFF';
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={isDisabled}
      style={[
        styles.button,
        getContainerStyle(),
        buttonStyle,
        style as ViewStyle,
      ]}
      {...props}>
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'outline' ? '#2563EB' : '#FFFFFF'}
        />
      ) : (
        <View style={styles.content}>
          {leftIcon && <View style={styles.leftIconWrapper}>{leftIcon}</View>}
          <Text style={[styles.text, { color: getTextColor() }, textStyle]}>
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    height: 54,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  leftIconWrapper: {
    marginRight: 10,
  },
});