import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { PrimaryButton } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { colors } from '@/lib/theme';

/**
 * Reads a PDF inside the app, without downloading it.
 *
 * Phones can't show a PDF in a web view on their own (Android can't at all), so the page
 * loads Mozilla's pdf.js and draws each page itself. The page is given the PDF's own address
 * as its origin, so reading the file needs no CORS setting on the server.
 *
 * Opened with: router.push({ pathname: '/pdf', params: { url, title } })
 */

// Old-browser build of pdf.js: works on every Android System WebView and iOS version we support.
const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/legacy/build';

export default function PdfViewer() {
  const { url = '', title } = useLocalSearchParams<{ url: string; title?: string }>();
  const t = useT();
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);

  const origin = url.match(/^https?:\/\/[^/]+/)?.[0];
  const html = useMemo(() => viewerHtml(url), [url]);

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data) as { type: string };
      if (msg.type === 'loaded') setState('ready');
      if (msg.type === 'error') setState('error');
    } catch {
      // not one of our messages
    }
  };

  const retry = () => {
    setState('loading');
    setAttempt((n) => n + 1); // new key: the web view starts over
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: title || t('screen.document'),
          headerRight: () => (
            <Pressable onPress={() => Linking.openURL(url)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('pdf.download')}>
              <Ionicons name="download-outline" size={22} color={colors.primary} />
            </Pressable>
          ),
        }}
      />

      {origin ? (
        <WebView
          key={attempt}
          source={{ html, baseUrl: `${origin}/` }}
          originWhitelist={['*']}
          onMessage={onMessage}
          onError={() => setState('error')}
          javaScriptEnabled
          scalesPageToFit={false}
          setBuiltInZoomControls
          setDisplayZoomControls={false}
          style={styles.web}
        />
      ) : null}

      {state === 'loading' && origin ? (
        <View style={styles.overlay} pointerEvents="none">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.muted}>{t('pdf.loading')}</Text>
        </View>
      ) : null}

      {state === 'error' || !origin ? (
        <View style={[styles.overlay, styles.errorBox]}>
          <Ionicons name="document-outline" size={40} color={colors.muted} />
          <Text style={styles.errorTitle}>{t('pdf.errorTitle')}</Text>
          <Text style={[styles.muted, { textAlign: 'center' }]}>{t('pdf.errorMsg')}</Text>
          <View style={styles.row}>
            <PrimaryButton label={t('pdf.retry')} variant="outline" icon="refresh-outline" onPress={retry} />
            <PrimaryButton label={t('pdf.download')} icon="download-outline" onPress={() => Linking.openURL(url)} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** The page shown in the web view: pdf.js draws the pages one under the other, only near the screen. */
function viewerHtml(url: string) {
  return `<!DOCTYPE html>
<html lang="fr"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes">
<style>
  html, body { margin: 0; background: ${colors.background}; }
  #pages { padding: 8px 0 24px; }
  .page { position: relative; margin: 0 auto 8px; width: calc(100% - 16px); background: #fff;
          box-shadow: 0 1px 3px rgba(0,0,0,.15); }
  .page canvas { display: block; width: 100%; height: 100%; }
  #counter { position: fixed; bottom: 14px; left: 50%; transform: translateX(-50%); padding: 5px 12px;
             border-radius: 14px; background: rgba(21,33,27,.75); color: #fff;
             font: 600 13px -apple-system, Roboto, sans-serif; display: none; }
</style>
</head><body>
<div id="pages"></div>
<div id="counter"></div>
<script src="${PDFJS}/pdf.min.js"></script>
<script>
(async function () {
  const send = (m) => window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(m));
  try {
    // The worker has to come from the page's own origin: load it as a blob.
    const workerCode = await (await fetch(${JSON.stringify(`${PDFJS}/pdf.worker.min.js`)})).text();
    pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([workerCode], { type: 'text/javascript' }));

    const pdf = await pdfjsLib.getDocument({ url: ${JSON.stringify(url)}, withCredentials: false }).promise;
    const first = await pdf.getPage(1);
    const ratio = first.getViewport({ scale: 1 }).height / first.getViewport({ scale: 1 }).width;

    const box = document.getElementById('pages');
    const counter = document.getElementById('counter');
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const div = document.createElement('div');
      div.className = 'page';
      div.dataset.n = i;
      div.style.aspectRatio = String(1 / ratio);   // real size is set when the page is drawn
      box.appendChild(div);
      pages.push(div);
    }

    // Draw a page when it comes near the screen, free it when it is far away (long dossiers).
    const drawn = new Map();
    async function draw(div) {
      const n = Number(div.dataset.n);
      if (drawn.has(n)) return;
      drawn.set(n, true);
      const page = await pdf.getPage(n);
      const base = page.getViewport({ scale: 1 });
      div.style.aspectRatio = String(base.width / base.height);
      // Sharp enough to zoom in a little, capped to keep memory low.
      const scale = Math.min((div.clientWidth * (window.devicePixelRatio || 1) * 1.5) / base.width, 2400 / base.width);
      const vp = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(vp.width);
      canvas.height = Math.floor(vp.height);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
      if (drawn.has(n)) div.replaceChildren(canvas);
    }
    function free(div) {
      const n = Number(div.dataset.n);
      if (!drawn.has(n)) return;
      drawn.delete(n);
      const c = div.querySelector('canvas');
      if (c) { c.width = 0; c.height = 0; c.remove(); }
    }
    const near = new IntersectionObserver((entries) => {
      for (const e of entries) e.isIntersecting ? draw(e.target).catch(() => {}) : free(e.target);
    }, { rootMargin: '150% 0px' });
    pages.forEach((p) => near.observe(p));

    // "3 / 12" while scrolling
    let hide;
    const visible = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) counter.textContent = e.target.dataset.n + ' / ' + pdf.numPages;
    }, { threshold: 0.5 });
    pages.forEach((p) => visible.observe(p));
    window.addEventListener('scroll', () => {
      if (pdf.numPages < 2) return;
      counter.style.display = 'block';
      clearTimeout(hide);
      hide = setTimeout(() => { counter.style.display = 'none'; }, 1200);
    }, { passive: true });

    send({ type: 'loaded', pages: pdf.numPages });
  } catch (e) {
    send({ type: 'error', message: String(e && e.message || e) });
  }
})();
</script>
</body></html>`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  web: { flex: 1, backgroundColor: colors.background },
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  errorBox: { backgroundColor: colors.background },
  errorTitle: { fontSize: 16, fontWeight: '600', color: colors.text, textAlign: 'center' },
  muted: { fontSize: 14, color: colors.muted },
  row: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 8 },
});
