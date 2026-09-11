import { StyleSheet, View, Text } from 'react-native';
import { statusColors, theme } from '@/constants/theme';

export function StatusBadge({ status, size = 'md' }: { status: string; size?: 'sm' | 'md' }) {
  const colors = statusColors[status] ?? { bg: 'rgba(148,163,184,0.1)', text: '#94a3b8', border: 'rgba(148,163,184,0.2)' };

  return (
    <View style={[
      styles.badge,
      { backgroundColor: colors.bg, borderColor: colors.border },
      size === 'sm' && styles.badgeSm,
    ]}>
      <Text style={[styles.text, { color: colors.text }, size === 'sm' && styles.textSm]}>
        {status}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeSm: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
  textSm: {
    fontSize: 10,
  },
});
