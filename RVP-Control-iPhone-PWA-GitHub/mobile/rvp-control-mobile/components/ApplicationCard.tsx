import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MapPin, User, Clock, AlertTriangle } from 'lucide-react-native';
import { StatusBadge } from '@/components/StatusBadge';
import { theme } from '@/constants/theme';
import { isOverdue, formatDate } from '@/lib/helpers';
import type { Application } from '@/types';

export function ApplicationCard({ app, onPress }: { app: Application; onPress: () => void }) {
  const overdue = isOverdue(app.deadline) && app.status !== 'Виконана' && app.status !== 'Скасована';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.header}>
        <Text style={styles.number}>{app.number}</Text>
        <StatusBadge status={app.status} size="sm" />
      </View>

      <Text style={styles.customer} numberOfLines={1}>{app.customer}</Text>

      {app.azkCode ? <Text style={styles.azk}>{app.azkCode}</Text> : null}

      <View style={styles.meta}>
        <View style={styles.metaRow}>
          <MapPin size={13} color={theme.textMuted} />
          <Text style={styles.metaText} numberOfLines={1}>{app.address}</Text>
        </View>
        <View style={styles.metaRow}>
          <User size={13} color={theme.textMuted} />
          <Text style={styles.metaText} numberOfLines={1}>{app.contractorName}</Text>
        </View>
        {app.deadline ? (
          <View style={styles.metaRow}>
            <Clock size={13} color={overdue ? theme.danger : theme.textMuted} />
            <Text style={[styles.metaText, overdue && styles.overdueText]}>
              {formatDate(app.deadline)}
            </Text>
            {overdue && <AlertTriangle size={12} color={theme.danger} />}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.bgCard,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 8,
  },
  cardPressed: {
    backgroundColor: theme.bgCardElevated,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  number: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.primary,
    fontFamily: 'monospace',
  },
  customer: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  azk: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  meta: {
    gap: 4,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    color: theme.textSecondary,
    flex: 1,
  },
  overdueText: {
    color: theme.danger,
    fontWeight: '600',
  },
});
