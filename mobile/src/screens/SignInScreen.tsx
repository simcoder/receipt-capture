import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { afterLogout } from "../auth/cognitoAuth";
import { useReceiptApi } from "../hooks/use-receipt-api";
import { useSession } from "../providers/session-provider";
import { clearCompanyQueue, loadLocalSession, saveOffline, saveQueue } from "../storage/localQueue";
import { deviceStore } from "../storage/deviceStore";
import { queueDraft, type LocalReceipt } from "../receipts/receiptDraft";
import { type CompanyReceipt } from "../receipts/receiptList";
import { clearFake } from "../receipts/submitReceipt";
import { ReceiptCapture } from "./ReceiptCapture";
import { HomeList } from "./HomeList";

export default function SignInScreen() {
  const session = useSession();
  const api = useReceiptApi();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [receipts, setReceipts] = useState<LocalReceipt[]>([]);
  const [previewCompany, setPreviewCompany] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [queueReady, setQueueReady] = useState(false);
  const [canPersist, setCanPersist] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [apiReceipts, setApiReceipts] = useState<CompanyReceipt[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [listReady, setListReady] = useState(false);
  const saveGeneration = useRef(0);
  const [error, setError] = useState<string | null>(null);

  const idToken = session.idToken;
  const showCapture = Boolean(idToken) || Boolean(previewCompany);
  const previewing = Boolean(previewCompany) && !idToken;
  const companyId = idToken ? session.companyId : (previewCompany ?? "");

  async function onSignIn() {
    setError(null);
    try {
      await session.signIn(username, password);
      setPassword("");
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : "Sign-in failed");
    }
  }

  useEffect(() => {
    if (!idToken) {
      setListReady(false);
      return;
    }
    if (!companyId) {
      setApiReceipts([]);
      setListError("missing company claim");
      setListReady(true);
      return;
    }
    let cancelled = false;
    setListReady(false);
    api.getReceipts(companyId)
      .then((rows) => {
        if (cancelled) return;
        setApiReceipts(rows);
        setListError(null);
        setListReady(true);
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setApiReceipts([]);
        setListError(loadError instanceof Error ? loadError.message : "Could not load receipts");
        setListReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [api, idToken, companyId]);

  useEffect(() => {
    if (!previewing || !companyId) {
      setQueueReady(false);
      return;
    }
    let cancelled = false;
    setQueueReady(false);
    setCanPersist(false);
    loadLocalSession(deviceStore, companyId)
      .then((loaded) => {
        if (cancelled) return;
        setReceipts(loaded.receipts);
        setOffline(loaded.offline);
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
  }, [previewing, companyId]);

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
    await session.clearTokens();
    setReceipts(cleared.queue);
    setApiReceipts([]);
    setListError(null);
    setPreviewCompany(null);
    setUsername("");
  }

  function replaceReceipt(next: LocalReceipt) {
    setReceipts((current) => current.map((item) => (item.localId === next.localId ? next : item)));
  }

  async function send(receipt: LocalReceipt) {
    const idempotencyKey = receipt.idempotencyKey ?? `local-${receipt.localId}`;
    const result = await api.submit({
      store: deviceStore,
      companyId: receipt.companyId,
      merchant: receipt.merchant,
      amountMinor: receipt.amountMinor,
      currency: receipt.currency,
      date: receipt.date,
      idempotencyKey,
      offline,
    });
    replaceReceipt({
      ...receipt,
      idempotencyKey,
      receiptId: result.receiptId,
      status: result.status,
      replayed: result.replayed,
      submitSource: result.source,
      ...(result.matchedTransactionId ? { matchedTransactionId: result.matchedTransactionId } : {}),
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
      await send(queued);
    } catch (submitError) {
      setQueueError(submitError instanceof Error ? submitError.message : "Could not submit the receipt");
    }
  }

  async function onConfirm(localId: string, transactionId: string) {
    const current = receipts.find((item) => item.localId === localId);
    if (!current?.receiptId) return;
    setMatchError(null);
    try {
      const result = await api.confirmMatch({
        store: deviceStore,
        siblings: receipts,
        receipt: {
          receiptId: current.receiptId,
          companyId: current.companyId,
          merchant: current.merchant,
          amountMinor: current.amountMinor,
          currency: current.currency,
          date: current.date,
          status: current.status,
        },
        transactionId,
        offline,
        submitSource: current.submitSource,
      });
      replaceReceipt({
        ...current,
        status: result.status,
        matchedTransactionId: result.matchedTransactionId,
        userCorrected: result.userCorrected,
      });
    } catch (confirmError) {
      setMatchError(confirmError instanceof Error ? confirmError.message : "Could not confirm the match");
    }
  }

  if (session.busy && !showCapture) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (idToken && !listReady) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (idToken) {
    return (
      <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
        <StatusBar style="dark" />
        <HomeList companyId={companyId} receipts={apiReceipts} error={listError} onLogout={onLogout} />
      </SafeAreaView>
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
          onConfirm={(localId, transactionId) => void onConfirm(localId, transactionId)}
          matchError={matchError}
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
        <Text style={styles.hint}>Use northwind.demo or contoso.demo. Passwords are in infra/README.md.</Text>
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
        {!session.region || !session.clientId ? (
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
