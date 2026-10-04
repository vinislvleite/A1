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

export interface LoginScreenProps {
  onLoginSuccess?: (data: { identifier: string }) => void;
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});

  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [isRegisterLoading, setIsRegisterLoading] = useState(false);
  const [registerErrors, setRegisterErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    general?: string;
  }>({});

  const authService = new AuthService();

  useEffect(() => {
    const initializeAuth = async () => {
      try {
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

  const validateLogin = (): boolean => {
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
    if (!validateLogin()) return;

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
    } catch {
      setIsLoading(false);
      Alert.alert('Erro', 'Falha ao utilizar a biometria.');
    }
  };

  const validateRegister = (): boolean => {
    const newErrors: {
      name?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
      general?: string;
    } = {};

    if (!registerName.trim()) {
      newErrors.name = 'Informe seu nome completo';
    }

    if (!registerEmail.trim() || !registerEmail.includes('@')) {
      newErrors.email = 'Informe um e-mail válido';
    }

    if (registerPassword.length < 8) {
      newErrors.password = 'A senha deve ter no mínimo 8 caracteres';
    } else if (!/[A-Z]/.test(registerPassword)) {
      newErrors.password = 'A senha deve conter ao menos uma letra maiúscula';
    } else if (!/[^A-Za-z0-9]/.test(registerPassword)) {
      newErrors.password = 'A senha deve conter ao menos um caractere especial';
    }

    if (registerPassword !== registerConfirmPassword) {
      newErrors.confirmPassword = 'As senhas não coincidem';
    }

    setRegisterErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    Keyboard.dismiss();
    if (!validateRegister()) return;

    setIsRegisterLoading(true);
    setRegisterErrors({});

    try {
      const result = await authService.register(registerName, registerEmail, registerPassword);
      setIsRegisterLoading(false);

      if (!result.success) {
        setRegisterErrors({
          general: result.error ?? 'Falha ao realizar cadastro.',
        });
        return;
      }

      if (onLoginSuccess) {
        onLoginSuccess({ identifier: registerEmail });
      }
    } catch (error: unknown) {
      setIsRegisterLoading(false);
      const message = error instanceof Error ? error.message : 'Falha ao realizar cadastro.';
      setRegisterErrors({ general: message });
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
              <AppLogoIcon size={76} borderRadius={20} />
              <Text style={[styles.title, { color: titleColor }]}>
                Orçamento Fácil
              </Text>
              <Text style={[styles.subtitle, { color: subtitleColor }]}>
                Gestão financeira pessoal simples e segura
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
              <View style={styles.tabsContainer}>
                <TouchableOpacity
                  testID="tab-login"
                  accessibilityLabel="Aba Entrar"
                  style={[
                    styles.tab,
                    activeTab === 'login' ? styles.activeTab : styles.inactiveTab,
                  ]}
                  activeOpacity={0.8}
                  onPress={() => {
                    setActiveTab('login');
                    setErrors({});
                  }}>
                  <Text
                    style={
                      activeTab === 'login'
                        ? styles.activeTabText
                        : styles.inactiveTabText
                    }>
                    Entrar{'\u200B'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  testID="tab-register"
                  accessibilityLabel="Aba Cadastro"
                  style={[
                    styles.tab,
                    activeTab === 'register' ? styles.activeTab : styles.inactiveTab,
                  ]}
                  activeOpacity={0.8}
                  onPress={() => {
                    setActiveTab('register');
                    setRegisterErrors({});
                  }}>
                  <Text
                    style={
                      activeTab === 'register'
                        ? styles.activeTabText
                        : styles.inactiveTabText
                    }>
                    Cadastro
                  </Text>
                </TouchableOpacity>
              </View>

              {activeTab === 'login' ? (
                <>
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
                </>
              ) : (
                <>
                  <FinanceInput
                    label="Nome Completo"
                    placeholder="Digite seu nome completo"
                    value={registerName}
                    onChangeText={(text) => {
                      setRegisterName(text);
                      if (registerErrors.name) setRegisterErrors((prev) => ({ ...prev, name: undefined }));
                    }}
                    autoCapitalize="words"
                    autoCorrect={false}
                    leftIcon={<UserIcon size={20} color="#94A3B8" />}
                    error={registerErrors.name}
                  />

                  <FinanceInput
                    label="E-mail"
                    placeholder="Digite seu e-mail"
                    value={registerEmail}
                    onChangeText={(text) => {
                      setRegisterEmail(text);
                      if (registerErrors.email) setRegisterErrors((prev) => ({ ...prev, email: undefined }));
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    leftIcon={<UserIcon size={20} color="#94A3B8" />}
                    error={registerErrors.email}
                  />

                  <FinanceInput
                    label="Senha"
                    placeholder="Mínimo 8 caracteres"
                    value={registerPassword}
                    onChangeText={(text) => {
                      setRegisterPassword(text);
                      if (registerErrors.password) setRegisterErrors((prev) => ({ ...prev, password: undefined }));
                    }}
                    isPassword
                    leftIcon={<LockIcon size={20} color="#94A3B8" />}
                    error={registerErrors.password}
                  />

                  <Text style={styles.passwordHintText}>
                    Mínimo de 8 caracteres, com ao menos uma letra maiúscula e um caractere especial (!@#$).
                  </Text>

                  <FinanceInput
                    label="Confirmar Senha"
                    placeholder="Confirme sua senha"
                    value={registerConfirmPassword}
                    onChangeText={(text) => {
                      setRegisterConfirmPassword(text);
                      if (registerErrors.confirmPassword) {
                        setRegisterErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                      }
                    }}
                    isPassword
                    leftIcon={<LockIcon size={20} color="#94A3B8" />}
                    error={registerErrors.confirmPassword}
                  />

                  {registerErrors.general ? (
                    <Text style={styles.generalErrorText}>{registerErrors.general}</Text>
                  ) : null}

                  <View style={styles.actionContainer}>
                    <FinanceButton
                      title="Cadastrar"
                      variant="primary"
                      loading={isRegisterLoading}
                      onPress={handleRegister}
                    />
                  </View>
                </>
              )}
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
    marginBottom: 28,
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
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 22,
    borderWidth: 1,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 3,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  activeTab: {
    backgroundColor: '#2563EB',
  },
  inactiveTab: {
    backgroundColor: 'transparent',
  },
  activeTabText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  inactiveTabText: {
    color: '#94A3B8',
    fontWeight: '500',
    fontSize: 14,
  },
  actionContainer: {
    marginTop: 8,
    marginBottom: 8,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
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
    marginTop: 2,
    marginBottom: 12,
  },
  forgotPasswordText: {
    color: '#60A5FA',
    fontSize: 12,
    fontWeight: '500',
  },
  generalErrorText: {
    color: '#EF4444',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 10,
  },
  passwordHintText: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: -8,
    marginBottom: 12,
    paddingHorizontal: 4,
    lineHeight: 16,
  },
});
