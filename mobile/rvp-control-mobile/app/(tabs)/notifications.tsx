import { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Pressable, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Bell, FileText, User, AlertTriangle, FileCheck, CheckCircle, Clock, Wallet } from 'lucide-react-native';
import { EmptyState } from '@/components/EmptyState';
import { fetchNotifications, markNotificationRead } from '@/lib/api';
import { theme } from '@/constants/theme';
import { timeAgo } from '@/lib/helpers';
import type { AppNotification } from '@/types';

const NOTIF_ICONS: Record<string, { icon: React.ReactNode; color: string }> = {
  new: { icon: <FileText size={18} color={theme.primary} />, color: theme.primary },
  assigned: { icon: <User size={18} color={theme.primary} />, color: theme.primary },
  problem: { icon: <AlertTriangle size={18} color={theme.danger} />, color: theme.danger },
  act: { icon: <FileCheck size={18} color={theme.warning} />, color: theme.warning },
  completed: { icon: <CheckCircle size={18} color={theme.success} />, color: theme.success },
  overdue: { icon: <Clock size={18} color={theme.danger} />, color: theme.danger },
  payout: { icon: <Wallet size={18} color={theme.warning} />, color: theme.warning },
};

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchNotifications();
      setNotifications(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const unreadCount = notifications.filter(n => !n.read).length;

  const handlePress = async (notif: AppNotification) => {
    if (!notif.read) {
      await markNotificationRead(notif.id);
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
    }
    if (notif.applicationId) {
      router.push(`/application/${notif.applicationId}`);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Сповіщення</Text>
        {unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{unreadCount}</Text>
          </View>
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20, gap: 8 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        {notifications.length === 0 && !loading ? (
          <EmptyState message="Сповіщень немає" icon={<Bell size={28} color={theme.textMuted} />} />
        ) : (
          notifications.map(notif => {
            const cfg = NOTIF_ICONS[notif.type] ?? NOTIF_ICONS.new;
            return (
              <Pressable
                key={notif.id}
                onPress={() => handlePress(notif)}
                style={({ pressed }) => [styles.item, !notif.read && styles.itemUnread, pressed && styles.itemPressed]}
              >
                <View style={[styles.iconWrap, { backgroundColor: `${cfg.color}15` }]}>
                  {cfg.icon}
                </View>
                <View style={styles.content}>
                  <Text style={styles.itemTitle} numberOfLines={1}>{notif.title}</Text>
                  <Text style={styles.itemBody} numberOfLines={2}>{notif.body}</Text>
                  <Text style={styles.itemTime}>{timeAgo(notif.createdAt)}</Text>
                </View>
                {!notif.read && <View style={styles.unreadDot} />}
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  title: { fontSize: 22, fontWeight: '800', color: theme.textPrimary },
  unreadBadge: {
    backgroundColor: theme.danger,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  unreadText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.bgCard,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.border,
  },
  itemUnread: {
    borderColor: 'rgba(59,130,246,0.2)',
    backgroundColor: 'rgba(59,130,246,0.04)',
  },
  itemPressed: { opacity: 0.7 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flex: 1, gap: 2 },
  itemTitle: { fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  itemBody: { fontSize: 13, color: theme.textSecondary },
  itemTime: { fontSize: 11, color: theme.textMuted, marginTop: 2 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.primary,
  },
});
