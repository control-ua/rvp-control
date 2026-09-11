import { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet, View, Text, ScrollView, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Clock, UserX, AlertTriangle, FileCheck, Wallet } from 'lucide-react-native';
import { ControlCard } from '@/components/ControlCard';
import { EmptyState } from '@/components/EmptyState';
import { fetchControlCenter } from '@/lib/api';
import { theme } from '@/constants/theme';
import type { ControlCenterItem } from '@/types';

export default function ControlScreen() {
  const router = useRouter();
  const [items, setItems] = useState<ControlCenterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchControlCenter();
      setItems(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const counts = {
    overdue: items.filter(i => i.type === 'overdue').length,
    no_contractor: items.filter(i => i.type === 'no_contractor').length,
    problem: items.filter(i => i.type === 'problem').length,
    act_pending: items.filter(i => i.type === 'act_pending').length,
    payout_pending: items.filter(i => i.type === 'payout_pending').length,
  };

  const summaryCards = [
    { label: 'Прострочені', count: counts.overdue, icon: <Clock size={18} color={theme.danger} />, color: theme.danger },
    { label: 'Без підрядника', count: counts.no_contractor, icon: <UserX size={18} color={theme.warning} />, color: theme.warning },
    { label: 'Проблеми', count: counts.problem, icon: <AlertTriangle size={18} color={theme.danger} />, color: theme.danger },
    { label: 'Акти', count: counts.act_pending, icon: <FileCheck size={18} color={theme.primary} />, color: theme.primary },
    { label: 'Виплати', count: counts.payout_pending, icon: <Wallet size={18} color={theme.warning} />, color: theme.warning },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Контроль</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        <View style={styles.summaryRow}>
          {summaryCards.map(card => (
            <View key={card.label} style={styles.summaryCard}>
              {card.icon}
              <Text style={[styles.summaryCount, { color: card.color }]}>{card.count}</Text>
              <Text style={styles.summaryLabel}>{card.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.listSection}>
          <Text style={styles.sectionTitle}>Проблеми та увага</Text>
          {items.length === 0 && !loading ? (
            <EmptyState message="Все під контролем" />
          ) : (
            <View style={{ gap: 8 }}>
              {items.map(item => (
                <ControlCard
                  key={item.id}
                  item={item}
                  onPress={() => item.applicationId && router.push(`/application/${item.applicationId}`)}
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
  header: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  title: { fontSize: 22, fontWeight: '800', color: theme.textPrimary },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  summaryCard: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: theme.bgCard,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 6,
  },
  summaryCount: { fontSize: 26, fontWeight: '700' },
  summaryLabel: { fontSize: 12, color: theme.textMuted },
  listSection: { gap: 10 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: theme.textMuted, letterSpacing: 1 },
});
