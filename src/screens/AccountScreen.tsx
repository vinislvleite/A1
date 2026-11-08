import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { AuthService } from '../services/AuthService';
import { NotificationService } from '../services/NotificationService';
import { UserRepository } from '../data/repositories/UserRepository';
import { AccountRepository } from '../data/repositories/AccountRepository';
import { BudgetRepository } from '../data/repositories/BudgetRepository';
import { User } from '../domain/entities/User';
import { LogoutModal } from '../components/LogoutModal';

export function AccountScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [accountsCount, setAccountsCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [biometricEnabled, setBiometricEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  const authService = new AuthService();
  const notificationService = new NotificationService();
  const userRepository = new UserRepository();
  const accountRepository = new AccountRepository();
  const budgetRepository = new BudgetRepository();

  const loadUserData = useCallback(async () => {
    try {
      setIsLoading(true);
      const session = await authService.getCurrentUser();
      if (!session) {
        router.replace('/login' as unknown as Parameters<typeof router.replace>[0]);
        return;
      }

      const [fullUser, accounts, isSoundOn, bioSetting] = await Promise.all([
        userRepository.findById(session.userId),
        accountRepository.findAll(),
        notificationService.isSoundEnabled(),
        budgetRepository.getSetting('biometric_enabled'),
      ]);

      if (fullUser) {
        setUser(fullUser);
      } else {
        setUser({
          id: session.userId,
          name: session.name,
          email: session.email,
          username: session.username || session.email.split('@')[0],
          password_hash: '',
          created_at: session.loginAt,
        });
      }

      setAccountsCount(accounts.length);
      setSoundEnabled(isSoundOn);
      setBiometricEnabled(bioSetting !== 'false');
    } catch {
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUserData();
    }, [loadUserData])
  );

  const handleToggleSound = async (value: boolean) => {
    setSoundEnabled(value);
    await notificationService.setSoundEnabled(value);
  };

  const handleToggleBiometric = async (value: boolean) => {
    setBiometricEnabled(value);
    await budgetRepository.setSetting('biometric_enabled', value ? 'true' : 'false');
  };

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await authService.logout();
      setShowLogoutModal(false);
      router.replace('/login' as unknown as Parameters<typeof router.replace>[0]);
    } catch {
      setIsLoggingOut(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}>
          <Feather name="chevron-left" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Minha Conta</Text>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Carregando informações...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.profileCard}>
            <LinearGradient
              colors={['#60A5FA', '#1D4ED8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatarGradient}>
              <Feather name="user" size={36} color="#FFFFFF" />
            </LinearGradient>
            <Text style={styles.profileName}>{user?.name ?? 'Usuário'}</Text>
            <Text style={styles.profileEmail}>{user?.email ?? '—'}</Text>
            <View style={styles.activeBadge}>
              <View style={styles.activeBadgeDot} />
              <Text style={styles.activeBadgeText}>Conta Ativa</Text>
            </View>
          </View>

          <View style={styles.sectionGroup}>
            <Text style={styles.sectionTitle}>INFORMAÇÕES PESSOAIS</Text>

            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <View style={styles.infoIconWrapper}>
                  <Feather name="user" size={18} color="#60A5FA" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Nome Completo</Text>
                  <Text style={styles.infoValue}>{user?.name ?? '—'}</Text>
                </View>
              </View>

              <View style={styles.cardDivider} />

              <View style={styles.infoRow}>
                <View style={styles.infoIconWrapper}>
                  <Feather name="mail" size={18} color="#60A5FA" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>E-mail Cadastrado</Text>
                  <Text style={styles.infoValue}>{user?.email ?? '—'}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.sectionGroup}>
            <Text style={styles.sectionTitle}>NOTIFICAÇÕES E SOM</Text>
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <View style={styles.infoIconWrapper}>
                  <Feather
                    name={soundEnabled ? 'volume-2' : 'volume-x'}
                    size={18}
                    color="#60A5FA"
                  />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoValue}>Som das Notificações Financeiras</Text>
                  <Text style={styles.infoLabel}>
                    {soundEnabled
                      ? 'Alertas com som ativado'
                      : 'Modo silencioso ativo (notificações sem som)'}
                  </Text>
                </View>
                <Switch
                  value={soundEnabled}
                  onValueChange={handleToggleSound}
                  trackColor={{ false: '#334155', true: '#2563EB' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={styles.cardDivider} />

              <TouchableOpacity
                style={styles.infoRow}
                activeOpacity={0.7}
                onPress={() => router.push('/bills' as unknown as Parameters<typeof router.push>[0])}>
                <View style={styles.infoIconWrapper}>
                  <Feather name="bell" size={18} color="#F59E0B" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoValue}>Contas a Pagar e Lembretes</Text>
                  <Text style={styles.infoLabel}>Gerenciar contas fixas e avisos de vencimento</Text>
                </View>
                <Feather name="chevron-right" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.sectionGroup}>
            <Text style={styles.sectionTitle}>CONTAS, CATEGORIAS E LIMITES</Text>

            <View style={styles.infoCard}>
              <TouchableOpacity
                style={styles.infoRow}
                activeOpacity={0.7}
                onPress={() => router.push('/accounts' as unknown as Parameters<typeof router.push>[0])}>
                <View style={styles.infoIconWrapper}>
                  <Feather name="credit-card" size={18} color="#10B981" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoValue}>Contas e Cartões</Text>
                  <Text style={styles.infoLabel}>
                    {accountsCount} {accountsCount === 1 ? 'conta cadastrada' : 'contas cadastradas'}
                  </Text>
                </View>
                <Feather name="chevron-right" size={16} color="#64748B" />
              </TouchableOpacity>

              <View style={styles.cardDivider} />

              <TouchableOpacity
                style={styles.infoRow}
                activeOpacity={0.7}
                onPress={() => router.push('/categories' as unknown as Parameters<typeof router.push>[0])}>
                <View style={styles.infoIconWrapper}>
                  <Feather name="tag" size={18} color="#F59E0B" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoValue}>Categorias</Text>
                  <Text style={styles.infoLabel}>Personalizar categorias, cores e ícones</Text>
                </View>
                <Feather name="chevron-right" size={16} color="#64748B" />
              </TouchableOpacity>

              <View style={styles.cardDivider} />

              <TouchableOpacity
                style={styles.infoRow}
                activeOpacity={0.7}
                onPress={() => router.push('/spending-limits' as unknown as Parameters<typeof router.push>[0])}>
                <View style={styles.infoIconWrapper}>
                  <Feather name="sliders" size={18} color="#60A5FA" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoValue}>Tetos Diários e Limite por Transação</Text>
                  <Text style={styles.infoLabel}>Configurar limites de alerta de gastos</Text>
                </View>
                <Feather name="chevron-right" size={16} color="#64748B" />
              </TouchableOpacity>

              <View style={styles.cardDivider} />

              <TouchableOpacity
                style={styles.infoRow}
                activeOpacity={0.7}
                onPress={() => router.push('/spending-goals' as unknown as Parameters<typeof router.push>[0])}>
                <View style={styles.infoIconWrapper}>
                  <Feather name="target" size={18} color="#60A5FA" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoValue}>Metas de Gastos por Categoria</Text>
                  <Text style={styles.infoLabel}>Acompanhar e definir tetos mensais</Text>
                </View>
                <Feather name="chevron-right" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.sectionGroup}>
            <Text style={styles.sectionTitle}>SEGURANÇA E BIOMETRIA</Text>
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <View style={styles.infoIconWrapper}>
                  <Feather name="lock" size={18} color="#10B981" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoValue}>Autenticação por Biometria</Text>
                  <Text style={styles.infoLabel}>Permitir desbloqueio rápido com digital</Text>
                </View>
                <Switch
                  value={biometricEnabled}
                  onValueChange={handleToggleBiometric}
                  trackColor={{ false: '#334155', true: '#10B981' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={styles.cardDivider} />

              <TouchableOpacity
                style={styles.infoRow}
                activeOpacity={0.7}
                onPress={() => router.push('/forgot-password' as unknown as Parameters<typeof router.push>[0])}>
                <View style={styles.infoIconWrapper}>
                  <Feather name="key" size={18} color="#60A5FA" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoValue}>Redefinir Senha de Acesso</Text>
                  <Text style={styles.infoLabel}>Alterar senha local com criptografia SHA-256</Text>
                </View>
                <Feather name="chevron-right" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.sectionGroup}>
            <Text style={styles.sectionTitle}>BACKUP, DADOS E PRIVACIDADE</Text>
            <View style={styles.infoCard}>
              <TouchableOpacity
                style={styles.infoRow}
                activeOpacity={0.7}
                onPress={() => router.push('/backup' as unknown as Parameters<typeof router.push>[0])}>
                <View style={styles.infoIconWrapper}>
                  <Feather name="hard-drive" size={18} color="#60A5FA" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoValue}>Backup e Restauração</Text>
                  <Text style={styles.infoLabel}>Exportar e restaurar cópia criptografada</Text>
                </View>
                <Feather name="chevron-right" size={16} color="#64748B" />
              </TouchableOpacity>

              <View style={styles.cardDivider} />

              <TouchableOpacity
                style={styles.infoRow}
                activeOpacity={0.7}
                onPress={() => router.push('/data-cleanup' as unknown as Parameters<typeof router.push>[0])}>
                <View style={styles.infoIconWrapper}>
                  <Feather name="trash-2" size={18} color="#EF4444" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoValue}>Limpeza de Dados</Text>
                  <Text style={styles.infoLabel}>Excluir transações antigas ou em lote</Text>
                </View>
                <Feather name="chevron-right" size={16} color="#64748B" />
              </TouchableOpacity>

              <View style={styles.cardDivider} />

              <TouchableOpacity
                style={styles.infoRow}
                activeOpacity={0.7}
                onPress={() => router.push('/privacy-policy' as unknown as Parameters<typeof router.push>[0])}>
                <View style={styles.infoIconWrapper}>
                  <Feather name="shield" size={18} color="#10B981" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoValue}>Política de Privacidade</Text>
                  <Text style={styles.infoLabel}>Armazenamento 100% offline e proteção local</Text>
                </View>
                <Feather name="chevron-right" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.actionSection}>
            <TouchableOpacity
              style={styles.btnLogout}
              onPress={handleLogout}
              activeOpacity={0.8}>
              <Feather name="log-out" size={18} color="#EF4444" />
              <Text style={styles.btnLogoutText}>Sair da Conta</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      <LogoutModal
        visible={showLogoutModal}
        onCancel={() => setShowLogoutModal(false)}
        onConfirm={confirmLogout}
        isLoading={isLoggingOut}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSpacer: {
    width: 36,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 36,
    gap: 20,
  },
  profileCard: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  avatarGradient: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  profileName: {
    fontSize: 19,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 10,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 6,
  },
  activeBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  activeBadgeText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '600',
  },
  sectionGroup: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#64748B',
    paddingLeft: 4,
  },
  infoCard: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 14,
  },
  infoIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#334155',
  },
  actionSection: {
    marginTop: 6,
  },
  btnLogout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  btnLogoutText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
  },
});
