import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { theme } from '@/constants/theme';

export function SectionAccordion({
  title, icon, children, defaultOpen = false,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => setOpen(!open)}
        style={styles.header}
      >
        <View style={styles.headerLeft}>
          {icon}
          <Text style={styles.title}>{title}</Text>
        </View>
        <ChevronDown
          size={18}
          color={theme.textMuted}
          style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}
        />
      </Pressable>
      {open && <View style={styles.body}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  body: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 8,
  },
});
