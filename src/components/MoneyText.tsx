import React from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { usePrivacyMode, PrivacyManager } from '../context/PrivacyContext';

export const HIDDEN_MONEY_MASK = 'R$ ••••••';

export function formatMoneyValue(
  value: number,
  isPrivacyEnabled: boolean = PrivacyManager.isPrivacyEnabled(),
  options?: { prefix?: string; suffix?: string }
): string {
  const prefix = options?.prefix ?? '';
  const suffix = options?.suffix ?? '';

  if (isPrivacyEnabled) {
    return `${prefix}${HIDDEN_MONEY_MASK}${suffix}`;
  }

  const formatted = value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
  return `${prefix}${formatted}${suffix}`;
}

export interface MoneyTextProps {
  value: number;
  prefix?: string;
  suffix?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  forceVisible?: boolean;
}

export function MoneyText({
  value,
  prefix = '',
  suffix = '',
  style,
  numberOfLines,
  forceVisible = false,
}: MoneyTextProps) {
  const { isPrivacyEnabled } = usePrivacyMode();
  const masked = !forceVisible && isPrivacyEnabled;
  const display = formatMoneyValue(value, masked, { prefix, suffix });

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {display}
    </Text>
  );
}
