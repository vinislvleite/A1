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

export function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const authService = new AuthService();

  const handleRecover = async () => {
    setErrorMessage(null);

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Informe um e-mail válido.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await authService.recoverPassword(email);
      setIsLoading(false);

      if (result.success) {
        setIsSuccess(true);
        Alert.alert(
          'Recuperação Solicitada',
          'Enviamos as instruções para o seu e-mail cadastrado. Verifique sua caixa de entrada.',
          [
            {
              text: 'Voltar ao Login',
              onPress: () => router.back(),
            },
          ]
        );
      } else {
        setErrorMessage(result.error ?? 'Falha ao solicitar recuperação.');
      }
    } catch (error: unknown) {
      setIsLoading(false);
      const message = error instanceof Error ? error.message : 'Erro ao processar recuperação.';
      setErrorMessage(message);
    }
  };

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
              onPress={() => router.back()}
              activeOpacity={0.7}>
              <Feather name="chevron-left" size={20} color="#94A3B8" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Recuperar Senha</Text>
          </View>

          <View style={styles.iconContainer}>
            <Feather name="lock" size={36} color="#60A5FA" />
          </View>

          <Text style={styles.infoText}>
            Digite seu e-mail cadastrado e enviaremos um link para redefinir sua senha.
          </Text>

          {errorMessage !== null ? (
            <View style={styles.errorBanner}>
              <Feather name="alert-circle" size={16} color="#EF4444" />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {isSuccess ? (
            <View style={styles.successBanner}>
              <Feather name="check-circle" size={16} color="#10B981" />
              <Text style={styles.successText}>
                Link enviado com sucesso! Verifique seu e-mail.
              </Text>
            </View>
          ) : null}

          <View style={styles.inputBox}>
            <Feather name="mail" size={18} color="#64748B" />
            <TextInput
              style={styles.inputField}
              placeholder="Digite seu e-mail"
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

          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={handleRecover}
            disabled={isLoading}
            activeOpacity={0.85}>
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.btnPrimaryText}>Enviar Link de Recuperação</Text>
            )}
          </TouchableOpacity>
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
    marginBottom: 36,
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
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  infoText: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 28,
    paddingHorizontal: 10,
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
    marginBottom: 20,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  successBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  successText: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
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
    marginBottom: 20,
  },
  inputField: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    padding: 0,
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
});
