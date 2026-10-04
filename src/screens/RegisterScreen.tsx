import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AuthService } from '../services/AuthService';
import { SuccessCheckIcon } from '../components/SuccessCheckIcon';

export function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);

  const authService = new AuthService();

  const handleRegister = async () => {
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('Informe seu nome completo.');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Informe um e-mail válido.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('A senha deve ter no mínimo 8 caracteres.');
      return;
    }

    if (!/[A-Z]/.test(password)) {
      setErrorMessage('A senha deve conter ao menos uma letra maiúscula.');
      return;
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
      setErrorMessage('A senha deve conter ao menos um caractere especial.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('As senhas não coincidem.');
      return;
    }

    if (!agreePrivacy) {
      setErrorMessage('Você deve concordar com a Política de Privacidade.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await authService.register(name, email, password);
      setIsLoading(false);

      if (result.success) {
        setIsRegistered(true);
      } else {
        setErrorMessage(result.error ?? 'Falha ao criar conta.');
      }
    } catch (error: unknown) {
      setIsLoading(false);
      const message = error instanceof Error ? error.message : 'Erro ao criar conta.';
      setErrorMessage(message);
    }
  };

  if (isRegistered) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.confirmedContainer}>
          <View style={styles.confirmedCard}>
            <View style={styles.confirmedIconWrapper}>
              <SuccessCheckIcon size={76} />
            </View>

            <Text style={styles.confirmedTitle}>Conta Criada com Sucesso!</Text>

            <Text style={styles.confirmedDescription}>
              Seu cadastro foi realizado com sucesso. Seus dados estão seguros e criptografados localmente no seu dispositivo.
            </Text>

            <View style={styles.accountSummaryBox}>
              <View style={styles.accountSummaryRow}>
                <Feather name="user" size={16} color="#60A5FA" />
                <Text style={styles.accountSummaryName}>{name}</Text>
              </View>
              <View style={styles.accountSummaryRow}>
                <Feather name="mail" size={16} color="#94A3B8" />
                <Text style={styles.accountSummaryEmail}>{email}</Text>
              </View>
              <View style={styles.accountSummaryBadge}>
                <Feather name="shield" size={14} color="#4ADE80" />
                <Text style={styles.accountSummaryBadgeText}>Banco de dados sincronizado localmente</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.btnConfirmed}
              onPress={() => router.replace('/home' as unknown as Parameters<typeof router.replace>[0])}
              activeOpacity={0.85}>
              <Text style={styles.btnConfirmedText}>Acessar Meu Orçamento</Text>
              <Feather name="arrow-right" size={18} color="#FFFFFF" style={styles.btnConfirmedIcon} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View>
            <View style={styles.header}>
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => router.back()}
                activeOpacity={0.7}>
                <Feather name="chevron-left" size={20} color="#94A3B8" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Criar Conta</Text>
            </View>

            {errorMessage !== null ? (
              <View style={styles.errorBanner}>
                <Feather name="alert-circle" size={16} color="#EF4444" />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            <View style={styles.formGroup}>
              <View style={styles.inputBox}>
                <Feather name="user" size={18} color="#64748B" />
                <TextInput
                  style={styles.inputField}
                  placeholder="Nome completo"
                  placeholderTextColor="#64748B"
                  value={name}
                  onChangeText={(text: string) => {
                    setName(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                />
              </View>

              <View style={styles.inputBox}>
                <Feather name="mail" size={18} color="#64748B" />
                <TextInput
                  style={styles.inputField}
                  placeholder="E-mail"
                  placeholderTextColor="#64748B"
                  value={email}
                  onChangeText={(text: string) => {
                    setEmail(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputBox}>
                <Feather name="lock" size={18} color="#64748B" />
                <TextInput
                  style={styles.inputField}
                  placeholder="Senha"
                  placeholderTextColor="#64748B"
                  value={password}
                  onChangeText={(text: string) => {
                    setPassword(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((prev) => !prev)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={18}
                    color="#64748B"
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.inputBox}>
                <Feather name="lock" size={18} color="#64748B" />
                <TextInput
                  style={styles.inputField}
                  placeholder="Confirmar Senha"
                  placeholderTextColor="#64748B"
                  value={confirmPassword}
                  onChangeText={(text: string) => {
                    setConfirmPassword(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  secureTextEntry={!showConfirmPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword((prev) => !prev)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather
                    name={showConfirmPassword ? 'eye-off' : 'eye'}
                    size={18}
                    color="#64748B"
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setAgreePrivacy((prev) => !prev)}
              activeOpacity={0.8}>
              <View
                style={[
                  styles.checkboxBox,
                  agreePrivacy ? styles.checkboxBoxChecked : null,
                ]}>
                {agreePrivacy ? <Feather name="check" size={12} color="#FFFFFF" /> : null}
              </View>
              <Text style={styles.checkboxText}>
                Concordo com a{' '}
                <Text
                  style={styles.linkBlue}
                  onPress={() =>
                    Alert.alert(
                      'Política de Privacidade',
                      'Seus dados são armazenados exclusivamente de forma local e segura no seu dispositivo com criptografia.'
                    )
                  }>
                  Política de Privacidade
                </Text>
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={handleRegister}
              disabled={isLoading}
              activeOpacity={0.85}>
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.btnPrimaryText}>Criar Conta</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Já tem uma conta?{' '}
              <Text
                style={styles.linkBlue}
                onPress={() =>
                  router.push('/login' as unknown as Parameters<typeof router.push>[0])
                }>
                Entrar
              </Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  formGroup: {
    flexDirection: 'column',
    gap: 14,
    marginBottom: 18,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    gap: 10,
  },
  inputField: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    padding: 0,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 24,
  },
  checkboxBox: {
    width: 18,
    height: 18,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 4,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxBoxChecked: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  checkboxText: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  linkBlue: {
    color: '#60A5FA',
    fontWeight: '500',
  },
  btnPrimary: {
    width: '100%',
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  footer: {
    marginTop: 'auto',
    alignItems: 'center',
    paddingTop: 20,
  },
  footerText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  confirmedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  confirmedCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#1E293B',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  confirmedIconWrapper: {
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmedTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  confirmedDescription: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 20,
  },
  accountSummaryBox: {
    width: '100%',
    backgroundColor: '#0F172A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 14,
    marginBottom: 24,
  },
  accountSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  accountSummaryName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  accountSummaryEmail: {
    color: '#94A3B8',
    fontSize: 13,
    marginLeft: 8,
  },
  accountSummaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  accountSummaryBadgeText: {
    color: '#4ADE80',
    fontSize: 11,
    fontWeight: '500',
    marginLeft: 6,
  },
  btnConfirmed: {
    width: '100%',
    height: 54,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  btnConfirmedText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  btnConfirmedIcon: {
    marginLeft: 8,
  },
});
