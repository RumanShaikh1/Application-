import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { WebView } from 'react-native-webview'
import { startDispatchBridge } from './src/bridge/dispatchBridge'

// The entire app - Decision Replay, the Simulator, Tax Understanding, the
// Sandbox, and Learn - is the same web/ build used on desktop, loaded here
// over a local HTTP server (see MarketPaneHttpServer.kt) instead of a
// native screen per feature. web/src/lib/api.ts's fetch('http://localhost:8787/...')
// calls are served by that same native server, which forwards /api/* to
// dispatchBridge.ts - see that file and server/src/mobileDispatch.ts for
// the full request path.
const APP_URL = 'http://localhost:8787/'
const SERVER_PORT = 8787

type BridgeState = 'starting' | 'ready' | 'error'

export default function App() {
  const [bridgeState, setBridgeState] = useState<BridgeState>('starting')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    startDispatchBridge(SERVER_PORT)
      .then(() => setBridgeState('ready'))
      .catch((err: unknown) => {
        setErrorMessage(err instanceof Error ? err.message : 'Could not start the local server.')
        setBridgeState('error')
      })
  }, [])

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      {bridgeState === 'ready' && (
        <WebView
          source={{ uri: APP_URL }}
          style={styles.webview}
          originWhitelist={['http://localhost:8787']}
          onShouldStartLoadWithRequest={(request) => request.url.startsWith(APP_URL) || request.url === 'about:blank'}
        />
      )}
      {bridgeState === 'starting' && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
          <Text style={styles.statusText}>Starting MarketPane...</Text>
        </View>
      )}
      {bridgeState === 'error' && (
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>MarketPane couldn't start</Text>
          <Text style={styles.statusText}>{errorMessage}</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F1EA' },
  webview: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  statusText: { marginTop: 12, fontSize: 15, color: '#3A3630', textAlign: 'center' },
  errorTitle: { fontSize: 18, fontWeight: '600', color: '#3A3630', marginBottom: 8 }
})
