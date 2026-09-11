import { useState, useMemo, useCallback } from 'react';
import {
  StyleSheet, View, Text, TextInput, ScrollView, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Search } from 'lucide-react-native';
import { useApplications } from '@/hooks/useApplications';
import { ApplicationCard } from '@/components/ApplicationCard';
import { FilterChip } from '@/components/FilterChip';
import { EmptyState } from '@/components/EmptyState';
import { theme } from '@/constants/theme';
import { isOverdue } from '@/lib/helpers';
import type { ApplicationStatus } from '@/types';

type FilterId = 'all' | 'new' | 'no_contractor' | 'in_progress' | 'problems' | 'overdue' | 'completed';

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'Усі' },
  { id: 'new', label: 'Нові' },
  { id: 'no_contractor', label: 'Без підрядника' },
  { id: 'in_progress', label: 'В роботі' },
  { id: 'problems', label: 'Проблеми' },
  { id: 'overdue', label: 'Прострочені' },
  { id: 'completed', label: 'Виконані' },
];

export default function ApplicationsScreen() {
  const router = useRouter();
  const { applications, loading, refresh } = useApplications();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterId>('all');
  const [refreshing, setRefreshing] = useState(false);

  const filtered = useMemo(() => {
    return applications.filter(app => {
      if (search) {
        const q = search.toLowerCase().trim();
        const haystack = [app.number, app.customer, app.address, app.contractorName, app.azkCode ?? '']
          .join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      switch (filter) {
        case 'new': return app.status === 'Нова';
        case 'no_contractor': return !app.contractorId || app.contractorName === '—';
        case 'in_progress': return app.status === 'В роботі' || app.status === 'Прийнята';
        case 'problems': return isOverdue(app.deadline) && app.status !== 'Виконана' && app.status !== 'Скасована';
        case 'overdue': return isOverdue(app.deadline) && app.status !== 'Виконана' && app.status !== 'Скасована';
        case 'completed': return app.status === 'Виконана';
        default: return true;
      }
    });
  }, [applications, search, filter]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refresh().finally(() => setRefreshing(false));
  }, [refresh]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Заявки</Text>
        <Text style={styles.count}>{filtered.length} з {applications.length}</Text>
      </View>

      <View style={styles.searchWrap}>
        <Search size={16} color={theme.textMuted} />
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder="Пошук за номером, адресою..."
          placeholderTextColor={theme.textMuted}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        style={styles.filtersBar}
      >
        {FILTERS.map(f => (
          <FilterChip
            key={f.id}
            label={f.label}
            active={filter === f.id}
            onPress={() => setFilter(f.id)}
          />
        ))}
      </ScrollView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20, gap: 10 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        {filtered.length === 0 && !loading ? (
          <EmptyState message="Заявок не знайдено" />
        ) : (
          filtered.map(app => (
            <ApplicationCard
              key={app.id}
              app={app}
              onPress={() => router.push(`/application/${app.id}`)}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  title: { fontSize: 22, fontWeight: '800', color: theme.textPrimary },
  count: { fontSize: 13, color: theme.textMuted },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: theme.bgCard,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  search: {
    flex: 1,
    fontSize: 15,
    color: theme.textPrimary,
  },
  filtersBar: {
    flexGrow: 0,
    marginBottom: 8,
  },
});
