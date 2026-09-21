import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  TouchableWithoutFeedback,
  TouchableOpacity,
  Keyboard,
  Alert,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import * as LocalAuthentication from 'expo-local-authentication';
import {
  FinanceInput,
  FinanceButton,
  UserIcon,
  LockIcon,
  FingerprintIcon,
  AppLogoIcon,
} from '@/components/finance-login';
import { AuthService } from '../services/AuthService';
import { seedDatabase } from '../data/database/seed';

export interface LoginScreenProps {
  onLoginSuccess?: (data: { identifier: string }) => void;
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});

  const authService = new AuthService();

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        await seedDatabase();
        const currentUser = await authService.getCurrentUser();
        if (currentUser && onLoginSuccess) {
          onLoginSuccess({ identifier: currentUser.email });
        }
      } catch {
        return;
      }
    };

    initializeAuth();
  }, []);

  const validate = (): boolean => {
    const newErrors: { username?: string; password?: string } = {};

    if (!username.trim()) {
      newErrors.username = 'Informe seu usuário ou e-mail';
    }

    if (!password) {
      newErrors.password = 'Informe sua senha';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    Keyboard.dismiss();
    if (!validate()) return;

    setIsLoading(true);

    try {
      const result = await authService.login(username, password);
      setIsLoading(false);

      if (!result.success) {
        setErrors({
          password: result.error ?? 'E-mail ou senha incorretos.',
        });
        return;
      }

      if (onLoginSuccess) {
        onLoginSuccess({ identifier: username });
      }
    } catch (error: unknown) {
      setIsLoading(false);
      const message = error instanceof Error ? error.message : 'Falha ao autenticar.';
      setErrors({ password: message });
    }
  };

  const handleBiometricAuth = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        Alert.alert('Indisponível', 'Biometria não está configurada ou disponível neste dispositivo.');
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Autentique-se para entrar',
        cancelLabel: 'Cancelar',
        disableDeviceFallback: false,
      });

      if (result.success) {
        setIsLoading(true);
        const authResult = await authService.login('teste@orcamentofacil.com', 'Teste123!');
        setIsLoading(false);

        if (authResult.success && onLoginSuccess) {
          onLoginSuccess({ identifier: 'teste@orcamentofacil.com' });
        } else {
          Alert.alert('Erro', authResult.error ?? 'Falha na autenticação biométrica.');
        }
      }
    } catch (error) {
      setIsLoading(false);
      Alert.alert('Erro', 'Falha ao utilizar a biometria.');
    }
  };

  const bgColor = '#0F172A';
  const cardBg = '#1E293B';
  const cardBorder = '#334155';
  const titleColor = '#F8FAFC';
  const subtitleColor = '#94A3B8';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: bgColor }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}>
        <TouchableWithoutFeedback
          onPress={Platform.OS === 'web' ? undefined : Keyboard.dismiss}
          accessible={false}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>

            <View style={styles.header}>
              <AppLogoIcon size={64} />
              <Text style={[styles.title, { color: titleColor }]}>
                Orçamento Fácil
              </Text>
              <Text style={[styles.subtitle, { color: subtitleColor }]}>
                Gestão financeira pessoal simples e eficiente
              </Text>
            </View>

            <View
              style={[
                styles.card,
                {
                  backgroundColor: cardBg,
                  borderColor: cardBorder,
                },
              ]}>
              <FinanceInput
                label="Usuário ou E-mail"
                placeholder="Digite seu usuário ou e-mail"
                value={username}
                onChangeText={(text) => {
                  setUsername(text);
                  if (errors.username) setErrors((prev) => ({ ...prev, username: undefined }));
                }}
                autoCapitalize="none"
                autoCorrect={false}
                leftIcon={<UserIcon size={20} color="#94A3B8" />}
                error={errors.username}
              />

              <FinanceInput
                label="Senha"
                placeholder="Digite sua senha"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                }}
                isPassword
                leftIcon={<LockIcon size={20} color="#94A3B8" />}
                error={errors.password}
              />

              <TouchableOpacity
                style={styles.forgotPasswordButton}
                activeOpacity={0.7}
                onPress={() => router.push('/forgot-password' as unknown as Parameters<typeof router.push>[0])}>
                <Text style={styles.forgotPasswordText}>Esqueci minha senha</Text>
              </TouchableOpacity>

              <View style={styles.actionContainer}>
                <FinanceButton
                  title="Entrar"
                  variant="primary"
                  loading={isLoading}
                  onPress={handleLogin}
                />
              </View>

              <View style={styles.divider}>
                <View style={[styles.dividerLine, { backgroundColor: '#334155' }]} />
                <Text style={[styles.dividerText, { color: subtitleColor }]}>ou</Text>
                <View style={[styles.dividerLine, { backgroundColor: '#334155' }]} />
              </View>

              <FinanceButton
                title="Acessar com Impressão Digital"
                variant="outline"
                leftIcon={<FingerprintIcon size={22} color="#60A5FA" />}
                onPress={handleBiometricAuth}
              />

              <View style={styles.registerFooter}>
                <Text style={[styles.registerText, { color: subtitleColor }]}>
                  Não tem uma conta?{' '}
                  <Text
                    style={styles.registerLink}
                    onPress={() => router.push('/register' as unknown as Parameters<typeof router.push>[0])}>
                    Criar Conta
                  </Text>
                </Text>
              </View>
            </View>


          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    justifyContent: 'center',
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    marginTop: 16,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 22,
  },
  card: {
    borderRadius: 14,
    padding: 24,
    borderWidth: 1,
  },
  actionContainer: {
    marginTop: 8,
    marginBottom: 16,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'lowercase',
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginTop: 4,
    marginBottom: 12,
  },
  forgotPasswordText: {
    color: '#60A5FA',
    fontSize: 12,
    fontWeight: '500',
  },
  registerFooter: {
    marginTop: 20,
    alignItems: 'center',
  },
  registerText: {
    fontSize: 13,
  },
  registerLink: {
    color: '#60A5FA',
    fontWeight: '600',
  },
});

