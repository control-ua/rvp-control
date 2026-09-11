import { StyleSheet, View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Users, FileText, Calendar, Wallet, Trophy, Archive,
  Zap, History, ChevronRight, LogOut, Mail, Shield,
} from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { getAllowedPages } from '@/lib/permissions';
import { theme } from '@/constants/theme';
import type { MobilePageId } from '@/lib/permissions';

const ALL_PAGES: { id: MobilePageId; label: string; icon: React.ReactNode }[] = [
  { id: 'contractors', label: 'Підрядники', icon: <Users size={20} color={theme.textSecondary} /> },
  { id: 'acts', label: 'Акти', icon: <FileText size={20} color={theme.textSecondary} /> },
  { id: 'calendar', label: 'Календар', icon: <Calendar size={20} color={theme.textSecondary} /> },
  { id: 'finance', label: 'Фінанси', icon: <Wallet size={20} color={theme.textSecondary} /> },
  { id: 'rating', label: 'Рейтинг', icon: <Trophy size={20} color={theme.textSecondary} /> },
  { id: 'archive', label: 'Архів', icon: <Archive size={20} color={theme.textSecondary} /> },
  { id: 'automation', label: 'Автоматизація', icon: <Zap size={20} color={theme.textSecondary} /> },
  { id: 'audit-log', label: 'Журнал дій', icon: <History size={20} color={theme.textSecondary} /> },
];

const ROLE_LABELS: Record<string, string> = {
  owner: 'Власник',
  admin: 'Адміністратор',
  dispatcher: 'Диспетчер',
  accountant: 'Бухгалтер',
  viewer: 'Спостерігач',
};

export default function MoreScreen() {
  const { admin, signOut } = useAuth();
  const allowed = getAllowedPages(admin?.role ?? null);
  const visiblePages = ALL_PAGES.filter(p => allowed.includes(p.id));

  const handleLogout = () => {
    Alert.alert('Вийти', 'Ви впевнені?', [
      { text: 'Скасувати', style: 'cancel' },
      { text: 'Вийти', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Ще</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30, gap: 16 }}
      >
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {admin?.fullName?.charAt(0).toUpperCase() ?? '?'}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{admin?.fullName ?? '—'}</Text>
            <View style={styles.roleRow}>
              <Shield size={12} color={theme.primary} />
              <Text style={styles.roleText}>{ROLE_LABELS[admin?.role ?? 'viewer'] ?? '—'}</Text>
            </View>
            <View style={styles.emailRow}>
              <Mail size={12} color={theme.textMuted} />
              <Text style={styles.emailText} numberOfLines={1}>{admin?.email ?? '—'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>РОЗДІЛИ</Text>
          <View style={styles.menuGroup}>
            {visiblePages.map((page, idx) => (
              <Pressable
                key={page.id}
                onPress={() => { /* placeholder for sub-screens */ }}
                style={({ pressed }) => [
                  styles.menuItem,
                  idx > 0 && styles.menuItemBorder,
                  pressed && styles.menuPressed,
                ]}
              >
                {page.icon}
                <Text style={styles.menuText}>{page.label}</Text>
                <ChevronRight size={18} color={theme.textMuted} />
              </Pressable>
            ))}
          </View>
        </View>

        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => [styles.logoutButton, pressed && styles.logoutPressed]}
        >
          <LogOut size={20} color={theme.danger} />
          <Text style={styles.logoutText}>Вийти</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  header: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  title: { fontSize: 22, fontWeight: '800', color: theme.textPrimary },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: theme.bgCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(59,130,246,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 22, fontWeight: '700', color: theme.primary },
  profileInfo: { flex: 1, gap: 4 },
  profileName: { fontSize: 17, fontWeight: '700', color: theme.textPrimary },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  roleText: { fontSize: 13, color: theme.primary, fontWeight: '600' },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  emailText: { fontSize: 12, color: theme.textMuted, flex: 1 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: theme.textMuted, letterSpacing: 1 },
  menuGroup: {
    backgroundColor: theme.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuItemBorder: {
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  menuPressed: { backgroundColor: theme.bgCardElevated },
  menuText: { flex: 1, fontSize: 15, fontWeight: '500', color: theme.textPrimary },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: 14,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.15)',
  },
  logoutPressed: { opacity: 0.7 },
  logoutText: { fontSize: 16, fontWeight: '600', color: theme.danger },
});
