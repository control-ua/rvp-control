import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@/constants/theme';

export function KPICard({
  label, value, color = theme.primary, icon,
}: {
  label: string;
  value: number | string;
  color?: string;
  icon?: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        {icon}
        <Text style={[styles.value, { color }]}>{value}</Text>
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: theme.bgCard,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 8,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  value: {
    fontSize: 24,
    fontWeight: '700',
  },
  label: {
    fontSize: 12,
    color: theme.textMuted,
  },
});
