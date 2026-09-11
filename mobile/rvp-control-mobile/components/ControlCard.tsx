import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { theme, severityColors } from '@/constants/theme';
import type { ControlCenterItem } from '@/types';

export function ControlCard({ item, onPress }: { item: ControlCenterItem; onPress: () => void }) {
  const sev = severityColors[item.severity] ?? severityColors.info;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={[styles.dot, { backgroundColor: sev.text }]} />
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>
      </View>
      <View style={[styles.sevBadge, { backgroundColor: sev.bg }]}>
        <Text style={[styles.sevText, { color: sev.text }]}>
          {item.severity === 'critical' ? 'КРИТИЧНО' : item.severity === 'warning' ? 'УВАГА' : 'ІНФОРМАЦІЯ'}
        </Text>
      </View>
      <ChevronRight size={16} color={theme.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.bgCard,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 12,
  },
  cardPressed: {
    backgroundColor: theme.bgCardElevated,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  desc: {
    fontSize: 12,
    color: theme.textMuted,
  },
  sevBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sevText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
