import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

interface PolicyPillar {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  description: string;
  badge: string;
}

const PILLARS: PolicyPillar[] = [
  {
    icon: 'hard-drive',
    title: 'Armazenamento 100% Local (SQLite)',
    description:
      'Todas as suas contas bancárias, carteiras, transações e orçamentos são armazenados exclusivamente na memória do seu dispositivo. Nenhum dado financeiro é enviado para a nuvem, servidores externos ou terceiros.',
    badge: 'Offline-First',
  },
  {
    icon: 'lock',
    title: 'Criptografia SHA-256',
    description:
      'Suas credenciais de login são protegidas por algoritmo de hashing seguro SHA-256 com salt. Sua senha real nunca é armazenada em texto simples.',
    badge: 'Proteção Criptográfica',
  },
  {
    icon: 'cpu',
    title: 'Biometria Nativa Segura',
    description:
      'A autenticação por impressão digital ou reconhecimento facial utiliza o hardware de segurança dedicado do seu dispositivo móvel, sem acesso direto do aplicativo aos seus dados biométricos.',
    badge: 'Hardware Seguro',
  },
  {
    icon: 'eye-off',
    title: 'Zero Rastreamento e Sem Anúncios',
    description:
      'O Orçamento Fácil não possui SDKs de análise de terceiros, não vende suas informações, não exibe anúncios intrusivos e não monitora sua atividade financeira.',
    badge: 'Privacidade Total',
  },
  {
    icon: 'trash-2',
    title: 'Controle Total e Limpeza de Dados',
    description:
      'Você é o único proprietário dos seus dados. A qualquer momento, você pode excluir transações antigas, apagar contas ou zerar o histórico na ferramenta de Limpeza de Dados.',
    badge: 'Autonomia do Usuário',
  },
];

export function PrivacyPolicyScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topNav}>
        <TouchableOpacity
          style={styles.btnBack}
          onPress={() => router.back()}
          activeOpacity={0.7}>
          <Feather name="chevron-left" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Privacidade e Segurança</Text>
        <View style={styles.emptySpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroIconBox}>
            <Feather name="shield" size={32} color="#10B981" />
          </View>
          <Text style={styles.heroTitle}>Seus dados financeiros pertencem apenas a você</Text>
          <Text style={styles.heroDescription}>
            Construído sob o princípio de Privacidade por Design, todo o processamento e
            armazenamento ocorre offline no seu próprio aparelho.
          </Text>
          <View style={styles.heroBadge}>
            <View style={styles.heroBadgeDot} />
            <Text style={styles.heroBadgeText}>Ambiente 100% Protegido e Local</Text>
          </View>
        </View>

        <View style={styles.statusCard}>
          <Text style={styles.statusCardTitle}>STATUS DE SEGURANÇA LOCAL</Text>
          
          <View style={styles.statusRow}>
            <View style={styles.statusRowLeft}>
              <Feather name="database" size={16} color="#60A5FA" />
              <Text style={styles.statusLabel}>Banco de Dados</Text>
            </View>
            <Text style={styles.statusValue}>SQLite Local Isolado</Text>
          </View>

          <View style={styles.statusDivider} />

          <View style={styles.statusRow}>
            <View style={styles.statusRowLeft}>
              <Feather name="wifi-off" size={16} color="#10B981" />
              <Text style={styles.statusLabel}>Conexão Externa</Text>
            </View>
            <Text style={[styles.statusValue, styles.statusValueSuccess]}>Desconectado (Sem Nuvem)</Text>
          </View>

          <View style={styles.statusDivider} />

          <View style={styles.statusRow}>
            <View style={styles.statusRowLeft}>
              <Feather name="key" size={16} color="#F59E0B" />
              <Text style={styles.statusLabel}>Criptografia de Senhas</Text>
            </View>
            <Text style={styles.statusValue}>SHA-256 + Salt</Text>
          </View>
        </View>

        <View style={styles.sectionHeadingWrapper}>
          <Text style={styles.sectionHeading}>PILARE S DE PRIVACIDADE</Text>
        </View>

        <View style={styles.pillarsList}>
          {PILLARS.map((pillar, idx) => (
            <View key={idx} style={styles.pillarCard}>
              <View style={styles.pillarHeader}>
                <View style={styles.pillarIconBox}>
                  <Feather name={pillar.icon} size={18} color="#60A5FA" />
                </View>
                <View style={styles.pillarTitleBlock}>
                  <Text style={styles.pillarTitle}>{pillar.title}</Text>
                  <View style={styles.pillarBadge}>
                    <Text style={styles.pillarBadgeText}>{pillar.badge}</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.pillarDescription}>{pillar.description}</Text>
            </View>
          ))}
        </View>

        <View style={styles.actionSection}>
          <TouchableOpacity
            style={styles.btnCleanup}
            onPress={() =>
              router.push('/data-cleanup' as unknown as Parameters<typeof router.push>[0])
            }
            activeOpacity={0.85}>
            <Feather name="trash-2" size={18} color="#EF4444" style={styles.btnCleanupIcon} />
            <Text style={styles.btnCleanupText}>Gerenciar e Limpar Dados</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  btnBack: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  emptySpacer: {
    width: 36,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 22,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  heroIconBox: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 24,
  },
  heroDescription: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  heroBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  heroBadgeText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '600',
  },
  statusCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 16,
    marginBottom: 24,
  },
  statusCardTitle: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  statusRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusLabel: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500',
  },
  statusValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  statusValueSuccess: {
    color: '#10B981',
  },
  statusDivider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 4,
  },
  sectionHeadingWrapper: {
    marginBottom: 12,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  pillarsList: {
    gap: 12,
    marginBottom: 24,
  },
  pillarCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 16,
  },
  pillarHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
  },
  pillarIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  pillarTitleBlock: {
    flex: 1,
  },
  pillarTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  pillarBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pillarBadgeText: {
    color: '#60A5FA',
    fontSize: 10,
    fontWeight: '600',
  },
  pillarDescription: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 4,
  },
  actionSection: {
    marginTop: 4,
  },
  btnCleanup: {
    height: 50,
    borderRadius: 14,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCleanupIcon: {
    marginRight: 8,
  },
  btnCleanupText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '600',
  },
});
