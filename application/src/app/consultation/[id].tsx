import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, Card, CategoryBadge, ErrorState, Loading, PrimaryButton } from '@/components/ui';
import { api } from '@/lib/api';
import { daysLeft, formatDate, formatDateTime, formatMoney, sentenceCase, titleCase } from '@/lib/format';
import { useSaved } from '@/lib/store';
import { colors, radius } from '@/lib/theme';
import type { Consultation, DocumentLink } from '@/lib/types';

const PORTAL = 'https://www.marchespublics.gov.ma/pmmp/';

export default function ConsultationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useQuery({ queryKey: ['consultation', id], queryFn: () => api.consultation(id), enabled: Boolean(id) });
  // Files come from files-api, separately: if it is down, the page still works without the button.
  // While the server is downloading them from the portal (status "pending"), check again every 4 s.
  const filesQuery = useQuery({
    queryKey: ['files', id],
    queryFn: () => api.files(id),
    enabled: Boolean(id),
    retry: 1,
    refetchInterval: (q) => (q.state.data?.status === 'pending' ? 4000 : false),
  });
  const files = filesQuery.data?.files ?? [];
  const zipUrl = filesQuery.data?.zipUrl ?? null;
  const filesStatus = filesQuery.data?.status;
  const queryClient = useQueryClient();
  const fetchFiles = useMutation({
    mutationFn: () => api.fetchFiles(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['files', id] }),
  });
  // "Récupérer le dossier": the files aren't on the server yet but the portal has them.
  const preparing = !zipUrl && (filesStatus === 'pending' || fetchFiles.isPending);
  const canFetch = !zipUrl && !preparing && (filesStatus === 'idle' || filesStatus === 'failed');
  const fetchMessage =
    fetchFiles.error?.message ??
    (fetchFiles.data?.status === 'failed' ? fetchFiles.data.message : undefined) ??
    (filesStatus === 'failed' ? filesQuery.data?.message : undefined);
  const saved = useSaved((s) => Boolean(id && s.favorites[id]));
  const toggleFavorite = useSaved((s) => s.toggleFavorite);

  const c = query.data;

  const share = () => {
    if (!c) return;
    Share.share({
      message: `${sentenceCase(c.objet)}\nRéf. ${c.reference ?? '—'} · ${c.acheteur ?? ''}\nDate limite : ${formatDateTime(c.dateLimite)}\n${c.urlPortail ?? PORTAL}`,
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          title: c?.reference ? `Réf. ${c.reference}` : 'Consultation',
          headerRight: () =>
            c ? (
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <Pressable onPress={share} hitSlop={10} accessibilityRole="button" accessibilityLabel="Partager">
                  <Ionicons name="share-outline" size={22} color={colors.text} />
                </Pressable>
                <Pressable onPress={() => toggleFavorite(c)} hitSlop={10} accessibilityRole="button" accessibilityLabel={saved ? 'Retirer des favoris' : 'Ajouter aux favoris'}>
                  <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={22} color={colors.primary} />
                </Pressable>
              </View>
            ) : null,
        }}
      />

      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState message={query.error.message} onRetry={() => query.refetch()} />
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            <Summary c={query.data} />
            <Deadline iso={query.data.dateLimite} />
            <KeyFacts c={query.data} />
            <Documents docs={files.length ? files : (query.data.documents ?? [])} />
            <Timeline c={query.data} />
          </ScrollView>
          <SafeAreaView edges={['bottom']} style={styles.footer}>
            {zipUrl ? (
              <View style={styles.footerRow}>
                <PrimaryButton
                  label={`Télécharger le dossier (${files.length} ${files.length > 1 ? 'fichiers' : 'fichier'})`}
                  icon="download-outline"
                  onPress={() => download(zipUrl)}
                />
              </View>
            ) : preparing ? (
              <View style={styles.preparing}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.preparingText}>Récupération du dossier sur le portail… cela peut prendre 1 à 2 minutes.</Text>
              </View>
            ) : canFetch ? (
              <>
                {fetchMessage ? <Text style={styles.fetchError}>{fetchMessage}</Text> : null}
                <View style={styles.footerRow}>
                  <PrimaryButton
                    label={filesStatus === 'failed' || fetchFiles.isError ? 'Réessayer' : 'Récupérer le dossier'}
                    icon="cloud-download-outline"
                    onPress={() => fetchFiles.mutate()}
                  />
                </View>
              </>
            ) : null}
            <View style={styles.footerRow}>
              <PrimaryButton label="Partager" variant="outline" icon="share-outline" onPress={share} />
              <PrimaryButton label="Voir sur le portail" variant={zipUrl || preparing || canFetch ? 'outline' : 'solid'} icon="open-outline" onPress={() => WebBrowser.openBrowserAsync(query.data.urlPortail ?? PORTAL)} />
            </View>
          </SafeAreaView>
        </>
      )}
    </View>
  );
}

/**
 * Opens a download link outside the app: the phone's browser saves the file
 * (Android: Téléchargements, iPhone: app Fichiers). On the web it downloads directly.
 */
function download(url: string) {
  if (Platform.OS === 'web') {
    window.location.href = url;
    return;
  }
  Linking.openURL(url);
}

function Summary({ c }: { c: Consultation }) {
  return (
    <View style={styles.summary}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <CategoryBadge categorie={c.categorie} />
        {c.procedure ? <Badge label={c.procedure} bg={colors.neutralSoft} fg="#3B463F" /> : null}
        {c.reservePME ? <Badge label="Réservé PME" bg={colors.primarySoft} fg={colors.primaryDark} /> : null}
      </View>
      <Text style={styles.title} accessibilityRole="header">{sentenceCase(c.objet) || 'Sans objet'}</Text>
      <View style={styles.buyer}>
        <View style={styles.buyerIcon}>
          <Ionicons name="business-outline" size={20} color="#3B463F" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.buyerName}>{sentenceCase(c.acheteur) || '—'}</Text>
          <Text style={styles.muted}>Acheteur public</Text>
        </View>
      </View>
    </View>
  );
}

function Deadline({ iso }: { iso: string | null }) {
  const n = daysLeft(iso);
  if (n == null) return null;
  const closed = n < 0;
  return (
    <View style={[styles.deadline, closed && { backgroundColor: colors.neutralSoft }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.dlLabel, closed && { color: colors.muted }]}>DATE LIMITE DE REMISE DES PLIS</Text>
        <Text style={[styles.dlValue, closed && { color: colors.text }]}>{formatDateTime(iso)}</Text>
      </View>
      <View style={styles.dlCounter}>
        {closed ? (
          <Text style={[styles.dlSmall, { color: colors.muted }]}>Clôturée</Text>
        ) : (
          <>
            <Text style={styles.dlBig}>{n}</Text>
            <Text style={styles.dlSmall}>{n > 1 ? 'jours' : 'jour'}</Text>
          </>
        )}
      </View>
    </View>
  );
}

function KeyFacts({ c }: { c: Consultation }) {
  // Only show the facts your data actually has.
  const rows = (
    [
      ["Lieu d'exécution", [titleCase(c.lieuExecution), c.region].filter(Boolean).join(', ')],
      ['Procédure', c.procedure ?? ''],
      ['Estimation', c.estimation != null ? formatMoney(c.estimation) : ''],
      ['Caution provisoire', c.cautionProvisoire != null ? formatMoney(c.cautionProvisoire) : ''],
      ['Publication', c.datePublication ? formatDate(c.datePublication) : ''],
      ['Ouverture des plis', c.dateOuverturePlis ? formatDateTime(c.dateOuverturePlis) : ''],
      ['Visite des lieux', c.visiteLieux ? formatDateTime(c.visiteLieux) : ''],
      ['Référence', c.reference ?? ''],
    ] as [string, string][]
  ).filter(([, v]) => v);
  if (!rows.length) return null;

  return (
    <Card style={{ paddingVertical: 4, gap: 0 }}>
      <Text style={[styles.cardTitle, { marginTop: 10, marginBottom: 2 }]}>Informations clés</Text>
      {rows.map(([k, v], i) => (
        <View key={k} style={[styles.factRow, i === rows.length - 1 && { borderBottomWidth: 0 }]}>
          <Text style={styles.muted}>{k}</Text>
          <Text style={styles.factValue}>{v}</Text>
        </View>
      ))}
    </Card>
  );
}

function Documents({ docs: all }: { docs: DocumentLink[] }) {
  const docs = all.filter((d) => d?.url);
  if (!docs.length) return null;
  return (
    <Card>
      <Text style={styles.cardTitle}>Dossier de consultation</Text>
      {docs.map((d, i) => {
        const ext = (d.url.split('?')[0].split('.').pop() ?? '').toUpperCase();
        return (
          <Pressable
            key={`${d.url}-${i}`}
            onPress={() => download(d.url)}
            style={({ pressed }) => [styles.docRow, pressed && { opacity: 0.7 }]}
            accessibilityRole="link"
          >
            <View style={styles.docIcon}>
              <Text style={styles.docExt}>{ext.length <= 4 && ext ? ext : 'DOC'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.docName}>{d.nom || 'Document'}</Text>
              {d.taille ? <Text style={styles.muted}>{d.taille}</Text> : null}
            </View>
            <Ionicons name="download-outline" size={20} color={colors.primary} />
          </Pressable>
        );
      })}
    </Card>
  );
}

function Timeline({ c }: { c: Consultation }) {
  const now = Date.now();
  const steps = [
    { label: 'Publication', iso: c.datePublication },
    { label: 'Visite des lieux', iso: c.visiteLieux },
    { label: 'Remise des plis', iso: c.dateLimite },
    { label: 'Ouverture des plis', iso: c.dateOuverturePlis },
  ].filter((s) => s.iso);
  if (steps.length < 2) return null;

  return (
    <Card style={{ gap: 12 }}>
      <Text style={styles.cardTitle}>Calendrier</Text>
      {steps.map((s) => {
        const done = new Date(s.iso as string).getTime() < now;
        return (
          <View key={s.label} style={styles.stepRow}>
            <View style={[styles.dot, done ? { backgroundColor: colors.primary, borderColor: colors.primary } : { borderColor: colors.warning }]} />
            <Text style={[styles.stepLabel, !done && { fontWeight: '600' }]}>{s.label}</Text>
            <Text style={styles.muted}>{formatDate(s.iso)}</Text>
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12, paddingBottom: 24 },
  summary: { backgroundColor: colors.surface, padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, lineHeight: 26 },
  buyer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  buyerIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.neutralSoft, alignItems: 'center', justifyContent: 'center' },
  buyerName: { fontSize: 14, fontWeight: '600', color: colors.text },
  muted: { fontSize: 13, color: colors.muted },
  deadline: { marginHorizontal: 16, borderRadius: radius.lg, backgroundColor: colors.warningSoft, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  dlLabel: { fontSize: 11, fontWeight: '700', color: '#7A3B06', letterSpacing: 0.3 },
  dlValue: { fontSize: 17, fontWeight: '700', color: colors.warningDark },
  dlCounter: { backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center', minWidth: 56 },
  dlBig: { fontSize: 20, fontWeight: '700', color: colors.warning, lineHeight: 24 },
  dlSmall: { fontSize: 11, fontWeight: '600', color: colors.warning },
  cardTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  factRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.divider },
  factValue: { fontSize: 14, fontWeight: '600', color: colors.text, flexShrink: 1, textAlign: 'right' },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  docIcon: { width: 36, height: 36, borderRadius: 8, backgroundColor: colors.neutralSoft, alignItems: 'center', justifyContent: 'center' },
  docExt: { fontSize: 10, fontWeight: '700', color: '#3B463F' },
  docName: { fontSize: 14, fontWeight: '500', color: colors.text },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, backgroundColor: colors.surface },
  stepLabel: { flex: 1, fontSize: 14, color: colors.text },
  footerRow: { flexDirection: 'row', gap: 10 },
  preparing: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
  preparingText: { flex: 1, fontSize: 13, color: colors.muted },
  fetchError: { fontSize: 13, color: colors.warningDark },
  footer: { gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
});