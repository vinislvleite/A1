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
import * as LocalAuthentication from 'expo-local-authentication';
import { FingerprintIcon } from '@/components/finance-login';
import { AuthService } from '../services/AuthService';
import { UserRepository } from '../data/repositories/UserRepository';
import { SuccessCheckIcon } from '../components/SuccessCheckIcon';

type RecoveryStep = 'identify' | 'verify' | 'new_password' | 'confirmed';

export function ForgotPasswordScreen() {
  const [step, setStep] = useState<RecoveryStep>('identify');
  const [email, setEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const authService = new AuthService();
  const userRepository = new UserRepository();

  const handleIdentify = async () => {
    setErrorMessage(null);
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Informe um e-mail válido.');
      return;
    }

    setIsLoading(true);

    try {
      const user = await userRepository.findByEmail(cleanEmail);
      setIsLoading(false);

      if (!user) {
        setErrorMessage('Nenhuma conta encontrada com este e-mail no dispositivo.');
        return;
      }

      setUserName(user.name);
      setStep('verify');
    } catch (error: unknown) {
      setIsLoading(false);
      const message = error instanceof Error ? error.message : 'Erro ao consultar o banco de dados.';
      setErrorMessage(message);
    }
  };

  const handleBiometricVerify = async () => {
    setErrorMessage(null);

    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        Alert.alert(
          'Biometria Indisponível',
          'Biometria não cadastrada neste aparelho. Utilize a confirmação com seu nome completo abaixo.'
        );
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Confirme sua identidade para redefinir a senha',
        cancelLabel: 'Cancelar',
        disableDeviceFallback: false,
      });

      if (result.success) {
        setStep('new_password');
      } else {
        setErrorMessage('Autenticação biométrica não concluída.');
      }
    } catch {
      setErrorMessage('Falha ao acionar sensor biométrico.');
    }
  };

  const handleManualVerify = () => {
    setErrorMessage(null);
    const cleanAnswer = securityAnswer.trim().toLowerCase();
    const cleanExpected = userName.trim().toLowerCase();

    if (!cleanAnswer) {
      setErrorMessage('Informe seu nome completo para confirmar.');
      return;
    }

    if (cleanAnswer !== cleanExpected) {
      setErrorMessage('O nome informado não confere com o cadastro desta conta.');
      return;
    }

    setStep('new_password');
  };

  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
  const isPasswordValid = hasMinLength && hasUppercase && hasNumber && hasSpecial;

  const handleResetPassword = async () => {
    setErrorMessage(null);

    if (!isPasswordValid) {
      setErrorMessage('A senha deve atender a todos os requisitos de segurança.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('As senhas digitadas não coincidem.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await authService.resetPasswordLocally(email, newPassword);
      setIsLoading(false);

      if (result.success) {
        setStep('confirmed');
      } else {
        setErrorMessage(result.error ?? 'Falha ao redefinir senha.');
      }
    } catch (error: unknown) {
      setIsLoading(false);
      const message = error instanceof Error ? error.message : 'Erro ao gravar nova senha no banco.';
      setErrorMessage(message);
    }
  };

  if (step === 'confirmed') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.confirmedContainer}>
          <View style={styles.confirmedCard}>
            <View style={styles.confirmedIconWrapper}>
              <SuccessCheckIcon size={76} />
            </View>

            <Text style={styles.confirmedTitle}>Senha Redefinida!</Text>

            <Text style={styles.confirmedDescription}>
              Sua nova senha foi atualizada e salva com criptografia segura no banco de dados local.
            </Text>

            <View style={styles.accountSummaryBox}>
              <View style={styles.accountSummaryRow}>
                <Feather name="user" size={16} color="#60A5FA" />
                <Text style={styles.accountSummaryName}>{userName}</Text>
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
              onPress={() => router.replace('/login' as unknown as Parameters<typeof router.replace>[0])}
              activeOpacity={0.85}>
              <Text style={styles.btnConfirmedText}>Ir para o Login</Text>
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
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => {
                if (step === 'verify') setStep('identify');
                else if (step === 'new_password') setStep('verify');
                else router.back();
              }}
              activeOpacity={0.7}>
              <Feather name="chevron-left" size={20} color="#94A3B8" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Recuperar Senha</Text>
          </View>

          {errorMessage !== null ? (
            <View style={styles.errorBanner}>
              <Feather name="alert-circle" size={16} color="#EF4444" />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {step === 'identify' && (
            <View style={styles.stepContainer}>
              <View style={styles.iconContainer}>
                <Feather name="key" size={34} color="#60A5FA" />
              </View>

              <Text style={styles.stepTitle}>Identifique sua Conta</Text>
              <Text style={styles.infoText}>
                Informe seu e-mail cadastrado para localizar sua conta no banco de dados local.
              </Text>

              <View style={styles.inputBox}>
                <Feather name="mail" size={18} color="#64748B" />
                <TextInput
                  style={styles.inputField}
                  placeholder="Digite seu e-mail cadastrado"
                  placeholderTextColor="#64748B"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <TouchableOpacity
                style={styles.btnPrimary}
                onPress={handleIdentify}
                disabled={isLoading}
                activeOpacity={0.85}>
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.btnPrimaryText}>Buscar Conta</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {step === 'verify' && (
            <View style={styles.stepContainer}>
              <View style={styles.iconContainer}>
                <Feather name="shield" size={34} color="#60A5FA" />
              </View>

              <Text style={styles.stepTitle}>Confirmação de Identidade</Text>
              <Text style={styles.infoText}>
                Confirme sua identidade para liberar a redefinição de senha da sua conta.
              </Text>

              <TouchableOpacity
                style={styles.btnBiometric}
                onPress={handleBiometricVerify}
                activeOpacity={0.85}>
                <FingerprintIcon size={22} color="#60A5FA" />
                <Text style={styles.btnBiometricText}>Confirmar com Biometria</Text>
              </TouchableOpacity>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>ou confirme seus dados</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.inputBox}>
                <Feather name="user-check" size={18} color="#64748B" />
                <TextInput
                  style={styles.inputField}
                  placeholder="Digite seu nome completo cadastrado"
                  placeholderTextColor="#64748B"
                  value={securityAnswer}
                  onChangeText={(text) => {
                    setSecurityAnswer(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>

              <TouchableOpacity
                style={styles.btnSecondary}
                onPress={handleManualVerify}
                activeOpacity={0.85}>
                <Text style={styles.btnSecondaryText}>Validar Nome Completo</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 'new_password' && (
            <View style={styles.stepContainer}>
              <View style={styles.iconContainer}>
                <Feather name="shield" size={34} color="#60A5FA" />
              </View>

              <Text style={styles.stepTitle}>Criar Nova Senha</Text>
              <Text style={styles.infoText}>
                Defina sua nova senha de acesso com os requisitos abaixo.
              </Text>

              <View style={styles.inputBox}>
                <Feather name="lock" size={18} color="#64748B" />
                <TextInput
                  style={styles.inputField}
                  placeholder="Digite a nova senha"
                  placeholderTextColor="#64748B"
                  value={newPassword}
                  onChangeText={(text) => {
                    setNewPassword(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((prev) => !prev)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
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
                  placeholder="Confirme a nova senha"
                  placeholderTextColor="#64748B"
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword((prev) => !prev)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Feather
                    name={showConfirmPassword ? 'eye-off' : 'eye'}
                    size={18}
                    color="#64748B"
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.requirementsCard}>
                <Text style={styles.requirementsTitle}>Requisitos de Segurança:</Text>

                <View style={styles.reqRow}>
                  <Feather
                    name={hasMinLength ? 'check-circle' : 'circle'}
                    size={14}
                    color={hasMinLength ? '#4ADE80' : '#64748B'}
                  />
                  <Text style={[styles.reqText, hasMinLength && styles.reqTextActive]}>
                    Mínimo de 8 caracteres
                  </Text>
                </View>

                <View style={styles.reqRow}>
                  <Feather
                    name={hasUppercase ? 'check-circle' : 'circle'}
                    size={14}
                    color={hasUppercase ? '#4ADE80' : '#64748B'}
                  />
                  <Text style={[styles.reqText, hasUppercase && styles.reqTextActive]}>
                    Pelo menos 1 letra maiúscula (A-Z)
                  </Text>
                </View>

                <View style={styles.reqRow}>
                  <Feather
                    name={hasNumber ? 'check-circle' : 'circle'}
                    size={14}
                    color={hasNumber ? '#4ADE80' : '#64748B'}
                  />
                  <Text style={[styles.reqText, hasNumber && styles.reqTextActive]}>
                    Pelo menos 1 número (0-9)
                  </Text>
                </View>

                <View style={styles.reqRow}>
                  <Feather
                    name={hasSpecial ? 'check-circle' : 'circle'}
                    size={14}
                    color={hasSpecial ? '#4ADE80' : '#64748B'}
                  />
                  <Text style={[styles.reqText, hasSpecial && styles.reqTextActive]}>
                    Pelo menos 1 caractere especial (!, @, #, $, ...)
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.btnPrimary, !isPasswordValid && styles.btnDisabled]}
                onPress={handleResetPassword}
                disabled={isLoading || !isPasswordValid}
                activeOpacity={0.85}>
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.btnPrimaryText}>Salvar Nova Senha</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    marginRight: 12,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  stepContainer: {
    alignItems: 'stretch',
  },
  iconContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(96, 165, 250, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  stepTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  infoText: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 14,
    marginBottom: 20,
  },
  userCardAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  userCardInfo: {
    flex: 1,
  },
  userCardName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  userCardEmail: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 16,
  },
  inputField: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    marginLeft: 10,
    height: '100%',
  },
  btnPrimary: {
    width: '100%',
    backgroundColor: '#2563EB',
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  btnConfirmed: {
    width: '100%',
    height: 54,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
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
  btnBiometric: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#2563EB',
    height: 54,
    marginBottom: 16,
  },
  biometricIcon: {
    marginRight: 8,
  },
  btnBiometricText: {
    color: '#60A5FA',
    fontSize: 15,
    fontWeight: '600',
  },
  btnSecondary: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#475569',
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#334155',
  },
  dividerText: {
    color: '#64748B',
    fontSize: 12,
    marginHorizontal: 10,
  },
  requirementsCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 14,
    marginBottom: 16,
  },
  requirementsTitle: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  reqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 3,
  },
  reqText: {
    color: '#64748B',
    fontSize: 13,
    marginLeft: 8,
  },
  reqTextActive: {
    color: '#4ADE80',
    fontWeight: '500',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 10,
    padding: 12,
    marginBottom: 18,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
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
});
