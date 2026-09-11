import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { X, Phone, CheckCircle2 } from 'lucide-react-native';
import { theme } from '@/constants/theme';
import { formatCurrency } from '@/lib/helpers';
import type { Contractor } from '@/types';

export function ContractorSheet({
  visible, contractors, onSelect, onClose,
}: {
  visible: boolean;
  contractors: Contractor[];
  onSelect: (c: Contractor) => void;
  onClose: () => void;
}) {
  const active = contractors.filter(c => c.status === 'active');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Оберіть підрядника</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <X size={20} color={theme.textMuted} />
            </Pressable>
          </View>

          <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 30 }}>
            {active.length === 0 ? (
              <Text style={styles.empty}>Немає активних підрядників</Text>
            ) : (
              active.map(c => (
                <Pressable
                  key={c.id}
                  onPress={() => onSelect(c)}
                  style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
                >
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{c.name}</Text>
                    <View style={styles.itemMeta}>
                      <Phone size={12} color={theme.textMuted} />
                      <Text style={styles.itemPhone}>{c.phone}</Text>
                    </View>
                    <Text style={styles.itemStats}>
                      {c.totalApplications} заявок • {formatCurrency(c.totalPayout)}
                    </Text>
                  </View>
                  <CheckCircle2 size={20} color={theme.primary} />
                </Pressable>
              ))
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: theme.bgCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    maxHeight: '75%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 12,
  },
  itemPressed: {
    backgroundColor: theme.bgCardElevated,
  },
  itemInfo: {
    flex: 1,
    gap: 3,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  itemPhone: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  itemStats: {
    fontSize: 11,
    color: theme.textMuted,
  },
  empty: {
    textAlign: 'center',
    color: theme.textMuted,
    paddingVertical: 30,
    fontSize: 14,
  },
});
