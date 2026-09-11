import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@/constants/theme';

export function EmptyState({ message, icon }: { message: string; icon?: React.ReactNode }) {
  return (
    <View style={styles.container}>
      {icon}
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  text: {
    fontSize: 14,
    color: theme.textMuted,
    textAlign: 'center',
  },
});
