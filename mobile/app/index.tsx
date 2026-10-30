import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  afterLogout,
  companyIdFromIdToken,
  SECURE_STORE_KEYS,
  signInWithPassword,
} from "../src/cognitoAuth";
import { deviceStore } from "../src/deviceStore";
import { clearCompanyQueue, loadLocalSession, saveOffline, saveQueue } from "../src/localQueue";
import { queueDraft, type LocalReceipt } from "../src/receiptDraft";
import { ReceiptCapture } from "../src/ReceiptCapture";
import { clearFake, submitReceipt } from "../src/submitReceipt";

const region = process.env.EXPO_PUBLIC_COGNITO_REGION ?? "";
const clientId = process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID ?? "";
const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "";

export default function SignInScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [idToken, setIdToken] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<LocalReceipt[]>([]);
  const [previewCompany, setPreviewCompany] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [queueReady, setQueueReady] = useState(false);
  const [canPersist, setCanPersist] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const saveGeneration = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    Promise.all([
      SecureStore.getItemAsync(SECURE_STORE_KEYS[0]),
      SecureStore.getItemAsync(SECURE_STORE_KEYS[1]),
    ])
      .then(([storedId, storedAccess]) => {
        setIdToken(storedId);
        setAccessToken(storedAccess);
      })
      .finally(() => setBusy(false));
  }, []);

  async function onSignIn() {
    setError(null);
    if (!region || !clientId) {
      setError("Set the Cognito region and app client id from the infra stack outputs.");
      return;
    }
    setBusy(true);
    try {
      const tokens = await signInWithPassword({
        region,
        clientId,
        username: username.trim(),
        password,
      });
      await SecureStore.setItemAsync(SECURE_STORE_KEYS[0], tokens.idToken);
      await SecureStore.setItemAsync(SECURE_STORE_KEYS[1], tokens.accessToken);
      await SecureStore.setItemAsync(SECURE_STORE_KEYS[2], tokens.refreshToken);
      setIdToken(tokens.idToken);
      setAccessToken(tokens.accessToken);
      setPassword("");
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  const showCapture = Boolean(idToken) || Boolean(previewCompany);
  const companyId = idToken ? (companyIdFromIdToken(idToken) ?? "") : (previewCompany ?? "");

  useEffect(() => {
    if (!showCapture || !companyId) {
      setQueueReady(false);
      return;
    }
    let cancelled = false;
    setQueueReady(false);
    setCanPersist(false);
    loadLocalSession(deviceStore, companyId)
      .then((session) => {
        if (cancelled) return;
        setReceipts(session.receipts);
        setOffline(session.offline);
        setQueueError(null);
        setCanPersist(true);
        setQueueReady(true);
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setReceipts([]);
        setQueueError(loadError instanceof Error ? loadError.message : "Could not load the queue");
        setCanPersist(false);
        setQueueReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [showCapture, companyId]);

  useEffect(() => {
    if (!canPersist || !companyId) return;
    const generation = saveGeneration.current;
    const company = companyId;
    const snapshot = receipts;
    void saveQueue(deviceStore, company, snapshot).then(async () => {
      if (saveGeneration.current !== generation) {
        await clearCompanyQueue(deviceStore, company);
      }
    });
  }, [canPersist, companyId, receipts]);

  useEffect(() => {
    if (!canPersist) return;
    void saveOffline(deviceStore, offline);
  }, [canPersist, offline]);

  async function onLogout() {
    const cleared = afterLogout(receipts);
    saveGeneration.current += 1;
    setCanPersist(false);
    setQueueReady(false);
    if (companyId) {
      await clearCompanyQueue(deviceStore, companyId);
      await clearFake(deviceStore, companyId);
    }
    await Promise.all(cleared.deleteKeys.map((key) => SecureStore.deleteItemAsync(key)));
    setReceipts(cleared.queue);
    setIdToken(null);
    setAccessToken(null);
    setPreviewCompany(null);
    setUsername("");
  }

  function replaceReceipt(next: LocalReceipt) {
    setReceipts((current) => current.map((item) => (item.localId === next.localId ? next : item)));
  }

  async function send(receipt: LocalReceipt) {
    const idempotencyKey = receipt.idempotencyKey ?? `local-${receipt.localId}`;
    const result = await submitReceipt({
      store: deviceStore,
      companyId: receipt.companyId,
      merchant: receipt.merchant,
      amountMinor: receipt.amountMinor,
      currency: receipt.currency,
      date: receipt.date,
      idempotencyKey,
      accessToken,
      apiUrl,
      offline,
    });
    replaceReceipt({
      ...receipt,
      idempotencyKey,
      receiptId: result.receiptId,
      status: result.status,
      replayed: result.replayed,
      submitSource: result.source,
    });
  }

  async function queueAndSubmit(localId: string) {
    const current = receipts.find((item) => item.localId === localId);
    if (!current) return;
    setQueueError(null);
    try {
      const queued = {
        ...queueDraft(current),
        idempotencyKey: current.idempotencyKey ?? `local-${current.localId}`,
      };
      replaceReceipt(queued);
      if (offline) return;
      await send(queued);
    } catch (submitError) {
      setQueueError(submitError instanceof Error ? submitError.message : "Could not submit the receipt");
    }
  }

  async function submitExisting(localId: string) {
    const current = receipts.find((item) => item.localId === localId);
    if (!current) return;
    setQueueError(null);
    try {
      await send(current);
    } catch (submitError) {
      setQueueError(submitError instanceof Error ? submitError.message : "Could not submit the receipt");
    }
  }

  if (busy && !showCapture) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (showCapture && !queueReady) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (showCapture) {
    return (
      <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
        <StatusBar style="dark" />
        <ReceiptCapture
          companyId={companyId}
          offline={offline}
          queueError={queueError}
          receipts={receipts}
          onChange={setReceipts}
          onOfflineChange={setOffline}
          onQueue={(localId) => void queueAndSubmit(localId)}
          onSubmit={(localId) => void submitExisting(localId)}
          onLogout={onLogout}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.centered}>
      <StatusBar style="dark" />
      <Text style={styles.title}>Receipt capture</Text>
      <View style={styles.block}>
        <Text style={styles.hint}>
          Use northwind.demo or contoso.demo. Passwords are in infra/README.md.
        </Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setUsername}
          placeholder="Username"
          style={styles.input}
          value={username}
        />
        <TextInput
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry
          style={styles.input}
          value={password}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={styles.primary} onPress={onSignIn}>
          <Text style={styles.primaryText}>Sign in</Text>
        </Pressable>
        {!region || !clientId ? (
          <Pressable style={styles.secondary} onPress={() => setPreviewCompany("northwind")}>
            <Text>Preview form as northwind</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f7f7f5" },
  centered: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f7f7f5",
  },
  title: { fontSize: 28, fontWeight: "600", marginBottom: 24 },
  block: { gap: 12 },
  hint: { color: "#333", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  primary: { backgroundColor: "#1f3a2e", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  primaryText: { color: "#fff", fontWeight: "600" },
  secondary: {
    borderWidth: 1,
    borderColor: "#1f3a2e",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  error: { color: "#8a1f1f" },
});
