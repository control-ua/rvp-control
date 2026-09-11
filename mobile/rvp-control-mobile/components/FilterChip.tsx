import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@/constants/theme';

export function FilterChip({
  label, active, onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <View style={[styles.chip, active && styles.chipActive]}>
      <Text
        style={[styles.text, active && styles.textActive]}
        onPress={onPress}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: theme.bgCard,
    borderWidth: 1,
    borderColor: theme.border,
  },
  chipActive: {
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderColor: 'rgba(59,130,246,0.3)',
  },
  text: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.textSecondary,
  },
  textActive: {
    color: theme.primaryLight,
  },
});
