import { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Pressable, ActivityIndicator,
  Linking, Alert, RefreshControl, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft, MapPin, Calendar, FileText, Phone, User, DollarSign,
  History, MessageSquare, Paperclip, ChevronRight, UserPlus, Loader2,
  Clock, AlertTriangle,
} from 'lucide-react-native';
import { StatusBadge } from '@/components/StatusBadge';
import { SectionAccordion } from '@/components/SectionAccordion';
import { ContractorSheet } from '@/components/ContractorSheet';
import { EmptyState } from '@/components/EmptyState';
import {
  fetchApplicationById, fetchLinkedActs, fetchWorkHistory,
  fetchApplicationFiles, fetchApplicationComments, fetchContractors,
  assignContractor, insertApplicationComment,
} from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { canAssignContractor } from '@/lib/permissions';
import { theme, payoutColors } from '@/constants/theme';
import { formatCurrency, formatDate, formatDateTime, isOverdue } from '@/lib/helpers';
import type { Application, Contractor, Act, WorkHistoryEntry, ApplicationFile, ApplicationComment } from '@/types';

export default function ApplicationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { admin } = useAuth();
  const canAssign = canAssignContractor(admin?.role ?? null);

  const [app, setApp] = useState<Application | null>(null);
  const [acts, setActs] = useState<Act[]>([]);
  const [history, setHistory] = useState<WorkHistoryEntry[]>([]);
  const [files, setFiles] = useState<ApplicationFile[]>([]);
  const [comments, setComments] = useState<ApplicationComment[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [a, ac, h, f, c, cs] = await Promise.all([
        fetchApplicationById(id),
        fetchLinkedActs(id).catch(() => []),
        fetchWorkHistory(id).catch(() => []),
        fetchApplicationFiles(id).catch(() => []),
        fetchApplicationComments(id).catch(() => []),
        fetchContractors().catch(() => []),
      ]);
      setApp(a);
      setActs(ac);
      setHistory(h);
      setFiles(f);
      setComments(c);
      setContractors(cs);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const handleAssign = async (contractor: Contractor) => {
    setSheetVisible(false);
    setAssigning(true);
    try {
      await assignContractor(id, contractor.id);
      Alert.alert('Успіх', `Підрядника ${contractor.name} призначено`);
      await load();
    } catch (e) {
      Alert.alert('Помилка', e instanceof Error ? e.message : 'Не вдалося призначити');
    } finally {
      setAssigning(false);
    }
  };

  const handleCall = () => {
    if (app?.contractorPhone && app.contractorPhone !== '—') {
      Linking.openURL(`tel:${app.contractorPhone}`);
    }
  };

  const handleSendComment = async () => {
    if (!commentText.trim()) return;
    setSendingComment(true);
    try {
      await insertApplicationComment(id, commentText.trim());
      setCommentText('');
      const c = await fetchApplicationComments(id);
      setComments(c);
    } catch (e) {
      Alert.alert('Помилка', e instanceof Error ? e.message : 'Не вдалося додати');
    } finally {
      setSendingComment(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!app) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ArrowLeft size={24} color={theme.textPrimary} />
          </Pressable>
        </View>
        <EmptyState message="Заявку не знайдено" />
      </SafeAreaView>
    );
  }

  const overdue = isOverdue(app.deadline) && app.status !== 'Виконана' && app.status !== 'Скасована';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={24} color={theme.textPrimary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerNumber}>{app.number}</Text>
          <StatusBadge status={app.status} size="sm" />
        </View>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        <View style={styles.mainCard}>
          <Text style={styles.customer}>{app.customer}</Text>
          {app.azkCode ? <Text style={styles.azk}>{app.azkCode}</Text> : null}

          <View style={styles.infoGrid}>
            <View style={styles.infoRow}>
              <MapPin size={14} color={theme.textMuted} />
              <Text style={styles.infoText}>{app.address}</Text>
            </View>
            <View style={styles.infoRow}>
              <Calendar size={14} color={theme.textMuted} />
              <Text style={styles.infoText}>{formatDate(app.date)}</Text>
            </View>
            {app.deadline && (
              <View style={styles.infoRow}>
                <Clock size={14} color={overdue ? theme.danger : theme.textMuted} />
                <Text style={[styles.infoText, overdue && styles.overdueText]}>
                  Дедлайн: {formatDate(app.deadline)}
                </Text>
                {overdue && <AlertTriangle size={12} color={theme.danger} />}
              </View>
            )}
          </View>

          {app.description ? (
            <View style={styles.descBox}>
              <Text style={styles.descLabel}>Опис</Text>
              <Text style={styles.descText}>{app.description}</Text>
            </View>
          ) : null}

          {app.managerComment ? (
            <View style={styles.descBox}>
              <Text style={styles.descLabel}>Коментар менеджера</Text>
              <Text style={styles.descText}>{app.managerComment}</Text>
            </View>
          ) : null}
        </View>

        <SectionAccordion title="Підрядник" icon={<User size={16} color={theme.textSecondary} />} defaultOpen>
          <View style={styles.contractorRow}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.contractorName}>{app.contractorName}</Text>
              {app.contractorPhone !== '—' && (
                <Text style={styles.contractorPhone}>{app.contractorPhone}</Text>
              )}
            </View>
            {app.contractorPhone !== '—' && (
              <Pressable onPress={handleCall} style={styles.callBtn}>
                <Phone size={16} color={theme.primary} />
                <Text style={styles.callText}>Подзвонити</Text>
              </Pressable>
            )}
          </View>

          {canAssign && (
            <Pressable
              onPress={() => setSheetVisible(true)}
              disabled={assigning}
              style={({ pressed }) => [styles.assignBtn, pressed && styles.assignPressed, assigning && styles.assignDisabled]}
            >
              {assigning ? <Loader2 size={16} color="#fff" /> : <UserPlus size={16} color="#fff" />}
              <Text style={styles.assignText}>
                {app.contractorId ? 'ПЕРЕПРИЗНАЧИТИ' : 'ПРИЗНАЧИТИ ПІДРЯДНИКА'}
              </Text>
            </Pressable>
          )}
        </SectionAccordion>

        <SectionAccordion title="Фінанси" icon={<DollarSign size={16} color={theme.textSecondary} />}>
          <View style={styles.financeGrid}>
            <View style={styles.financeItem}>
              <Text style={styles.financeLabel}>Сума</Text>
              <Text style={styles.financeValue}>{formatCurrency(app.amount)}</Text>
            </View>
            <View style={styles.financeItem}>
              <Text style={styles.financeLabel}>Виплата</Text>
              <Text style={styles.financeValue}>{formatCurrency(app.payoutAmount)}</Text>
            </View>
            <View style={styles.financeItem}>
              <Text style={styles.financeLabel}>Об'єм</Text>
              <Text style={styles.financeValue}>{app.actualVolume ? `${app.actualVolume} м³` : '—'}</Text>
            </View>
            <View style={styles.financeItem}>
              <Text style={styles.financeLabel}>Статус виплати</Text>
              <View style={[styles.payoutBadge, { backgroundColor: payoutColors[app.payoutStatus]?.bg ?? 'rgba(148,163,184,0.1)' }]}>
                <Text style={[styles.payoutText, { color: payoutColors[app.payoutStatus]?.text ?? theme.textSecondary }]}>
                  {app.payoutStatus}
                </Text>
              </View>
            </View>
          </View>
        </SectionAccordion>

        <SectionAccordion title={`Акти (${acts.length})`} icon={<FileText size={16} color={theme.textSecondary} />}>
          {acts.length === 0 ? (
            <Text style={styles.emptySection}>Актів немає</Text>
          ) : (
            <View style={{ gap: 8 }}>
              {acts.map(act => (
                <View key={act.id} style={styles.subItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.subItemTitle}>{act.actNumber ?? 'Акт'}</Text>
                    <Text style={styles.subItemDate}>{formatDate(act.uploadDate)}</Text>
                  </View>
                  <StatusBadge status={act.status === 'approved' ? 'Підтверджено' : act.status === 'pending' ? 'На перевірці' : 'Відхилено'} size="sm" />
                </View>
              ))}
            </View>
          )}
        </SectionAccordion>

        <SectionAccordion title={`Файли (${files.length})`} icon={<Paperclip size={16} color={theme.textSecondary} />}>
          {files.length === 0 ? (
            <Text style={styles.emptySection}>Файлів немає</Text>
          ) : (
            <View style={{ gap: 8 }}>
              {files.map(file => (
                <View key={file.id} style={styles.subItem}>
                  <Paperclip size={14} color={theme.textMuted} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.subItemTitle} numberOfLines={1}>{file.fileName}</Text>
                    <Text style={styles.subItemDate}>{formatDate(file.createdAt)}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </SectionAccordion>

        <SectionAccordion title={`Коментарі (${comments.length})`} icon={<MessageSquare size={16} color={theme.textSecondary} />}>
          {comments.length > 0 && (
            <View style={{ gap: 8, marginBottom: 10 }}>
              {comments.map(c => (
                <View key={c.id} style={styles.commentItem}>
                  <View style={styles.commentAvatar}>
                    <Text style={styles.commentAvatarText}>{c.adminName.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.commentHeader}>
                      <Text style={styles.commentAuthor}>{c.adminName}</Text>
                      <Text style={styles.commentTime}>{formatDateTime(c.createdAt)}</Text>
                    </View>
                    <Text style={styles.commentText}>{c.message}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
          <View style={styles.commentInputRow}>
            <TextInput
              style={styles.commentInput}
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Додати коментар..."
              placeholderTextColor={theme.textMuted}
              multiline
            />
            <Pressable
              onPress={handleSendComment}
              disabled={!commentText.trim() || sendingComment}
              style={[styles.commentSend, (!commentText.trim() || sendingComment) && styles.commentSendDisabled]}
            >
              {sendingComment ? <Loader2 size={16} color="#fff" /> : <Text style={styles.commentSendText}>→</Text>}
            </Pressable>
          </View>
        </SectionAccordion>

        <SectionAccordion title={`Історія (${history.length})`} icon={<History size={16} color={theme.textSecondary} />}>
          {history.length === 0 ? (
            <Text style={styles.emptySection}>Записів немає</Text>
          ) : (
            <View style={{ gap: 8 }}>
              {history.map(entry => (
                <View key={entry.id} style={styles.subItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.subItemTitle}>{entry.title}</Text>
                    {entry.description && <Text style={styles.subItemDate}>{entry.description}</Text>}
                    <Text style={styles.subItemDate}>{formatDateTime(entry.completedAt)}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </SectionAccordion>

        <View style={{ height: 20 }} />
      </ScrollView>

      <ContractorSheet
        visible={sheetVisible}
        contractors={contractors}
        onSelect={handleAssign}
        onClose={() => setSheetVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerNumber: { fontSize: 16, fontWeight: '700', color: theme.primary, fontFamily: 'monospace' },
  mainCard: {
    backgroundColor: theme.bgCard,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 10,
  },
  customer: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
  azk: { fontSize: 14, color: theme.textSecondary },
  infoGrid: { gap: 6, marginTop: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontSize: 14, color: theme.textSecondary, flex: 1 },
  overdueText: { color: theme.danger, fontWeight: '600' },
  descBox: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 10,
    padding: 12,
    gap: 4,
    marginTop: 4,
  },
  descLabel: { fontSize: 11, fontWeight: '600', color: theme.textMuted, letterSpacing: 0.5 },
  descText: { fontSize: 14, color: theme.textSecondary, lineHeight: 20 },
  contractorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  contractorName: { fontSize: 15, fontWeight: '600', color: theme.textPrimary },
  contractorPhone: { fontSize: 13, color: theme.textMuted },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(59,130,246,0.1)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  callText: { fontSize: 13, fontWeight: '600', color: theme.primary },
  assignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.primary,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 10,
  },
  assignPressed: { backgroundColor: theme.primaryLight },
  assignDisabled: { opacity: 0.6 },
  assignText: { fontSize: 14, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },
  financeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  financeItem: {
    flexBasis: '47%',
    flexGrow: 1,
    gap: 4,
  },
  financeLabel: { fontSize: 12, color: theme.textMuted },
  financeValue: { fontSize: 16, fontWeight: '700', color: theme.textPrimary },
  payoutBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  payoutText: { fontSize: 12, fontWeight: '600' },
  subItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 10,
    padding: 12,
  },
  subItemTitle: { fontSize: 14, fontWeight: '500', color: theme.textPrimary },
  subItemDate: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  emptySection: { fontSize: 13, color: theme.textMuted, paddingVertical: 8 },
  commentItem: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 10,
    padding: 12,
  },
  commentAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(59,130,246,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  commentAvatarText: { fontSize: 13, fontWeight: '700', color: theme.primary },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  commentAuthor: { fontSize: 13, fontWeight: '600', color: theme.textPrimary },
  commentTime: { fontSize: 10, color: theme.textMuted },
  commentText: { fontSize: 13, color: theme.textSecondary, marginTop: 4, lineHeight: 18 },
  commentInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
  },
  commentInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.textPrimary,
    maxHeight: 80,
  },
  commentSend: {
    backgroundColor: theme.primary,
    borderRadius: 10,
    width: 40,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentSendDisabled: { opacity: 0.4 },
  commentSendText: { fontSize: 20, color: '#fff', fontWeight: '700' },
});
