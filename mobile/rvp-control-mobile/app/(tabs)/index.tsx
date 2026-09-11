import { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Pressable, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Bell, FilePlus, Wrench, AlertTriangle, Clock } from 'lucide-react-native';
import { KPICard } from '@/components/KPICard';
import { ApplicationCard } from '@/components/ApplicationCard';
import { EmptyState } from '@/components/EmptyState';
import { fetchDashboardStats, fetchControlCenter } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { theme } from '@/constants/theme';
import { timeAgo } from '@/lib/helpers';
import type { Application, ControlCenterItem } from '@/types';

export default function DashboardScreen() {
  const router = useRouter();
  const { admin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ newCount: 0, inProgressCount: 0, problemCount: 0, overdueCount: 0, recent: [] as Application[] });
  const [controlItems, setControlItems] = useState<ControlCenterItem[]>([]);

  const load = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([
        fetchDashboardStats(),
        fetchControlCenter().catch(() => [] as ControlCenterItem[]),
      ]);
      setStats(s);
      setControlItems(c.slice(0, 8));
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>RVP CONTROL</Text>
          <Text style={styles.headerSub}>Операційний центр</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.adminName} numberOfLines={1}>{admin?.fullName ?? '—'}</Text>
          <Pressable onPress={() => router.push('/(tabs)/notifications')} hitSlop={12}>
            <Bell size={22} color={theme.textSecondary} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        <View style={styles.kpiRow}>
          <KPICard label="Нові" value={stats.newCount} color={theme.primary} icon={<FilePlus size={18} color={theme.primary} />} />
          <KPICard label="В роботі" value={stats.inProgressCount} color={theme.warning} icon={<Wrench size={18} color={theme.warning} />} />
        </View>
        <View style={styles.kpiRow}>
          <KPICard label="Проблеми" value={stats.problemCount} color={theme.danger} icon={<AlertTriangle size={18} color={theme.danger} />} />
          <KPICard label="Прострочені" value={stats.overdueCount} color={theme.danger} icon={<Clock size={18} color={theme.danger} />} />
        </View>

        {controlItems.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ПОТРЕБУЄ УВАГИ</Text>
            {controlItems.map(item => (
              <Pressable
                key={item.id}
                onPress={() => item.applicationId && router.push(`/application/${item.applicationId}`)}
                style={({ pressed }) => [styles.attentionItem, pressed && styles.attentionPressed]}
              >
                <View style={[styles.attentionDot, { backgroundColor: item.severity === 'critical' ? theme.danger : item.severity === 'warning' ? theme.warning : theme.primary }]} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.attentionTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.attentionDesc} numberOfLines={1}>{item.description}</Text>
                </View>
                <Text style={styles.attentionTime}>{timeAgo(item.createdAt)}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ОСТАННІ ЗАЯВКИ</Text>
          {stats.recent.length === 0 ? (
            <EmptyState message="Заявок немає" />
          ) : (
            <View style={{ gap: 10 }}>
              {stats.recent.map(app => (
                <ApplicationCard
                  key={app.id}
                  app={app}
                  onPress={() => router.push(`/application/${app.id}`)}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: theme.textPrimary, letterSpacing: 1 },
  headerSub: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  adminName: { fontSize: 12, color: theme.textSecondary, maxWidth: 120 },
  kpiRow: { flexDirection: 'row', gap: 12 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: theme.textMuted, letterSpacing: 1 },
  attentionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.bgCard,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 12,
  },
  attentionPressed: { backgroundColor: theme.bgCardElevated },
  attentionDot: { width: 8, height: 8, borderRadius: 4 },
  attentionTitle: { fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  attentionDesc: { fontSize: 12, color: theme.textMuted },
  attentionTime: { fontSize: 10, color: theme.textMuted },
});
