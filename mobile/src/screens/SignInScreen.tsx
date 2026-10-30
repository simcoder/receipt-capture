import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { afterLogout } from "../auth/cognitoAuth";
import { useReceiptApi } from "../hooks/use-receipt-api";
import { useConnectivity } from "../providers/connectivity-provider";
import { useSession } from "../providers/session-provider";
import { clearCompanyQueue, loadLocalSession, saveQueue } from "../storage/localQueue";
import { deviceStore } from "../storage/deviceStore";
import { chooseReceiptPhoto, takeReceiptPhoto } from "../receipts/pickReceiptImage";
import { DEVICE_PHOTO_ID, queueDraft, type LocalReceipt, type ReceiptImageId } from "../receipts/receiptDraft";
import { type CompanyReceipt } from "../receipts/receiptList";
import { clearFake } from "../receipts/submitReceipt";
import { AppMenu, type AppTab } from "./AppMenu";
import { CaptureScreen } from "./CaptureScreen";
import { CaptureSheet } from "./CaptureSheet";
import { ReceiptCapture } from "./ReceiptCapture";
import { HomeList } from "./HomeList";
import { ProfileScreen } from "./ProfileScreen";
import { ReviewReceipt } from "./ReviewReceipt";

export default function SignInScreen() {
  const session = useSession();
  const api = useReceiptApi();
  const { online } = useConnectivity();
  const offline = !online;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [receipts, setReceipts] = useState<LocalReceipt[]>([]);
  const [previewCompany, setPreviewCompany] = useState<string | null>(null);
  const [queueReady, setQueueReady] = useState(false);
  const [canPersist, setCanPersist] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [apiReceipts, setApiReceipts] = useState<CompanyReceipt[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [listReady, setListReady] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [visit, setVisit] = useState<{ imageId: ReceiptImageId; photoBase64?: string } | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [tab, setTab] = useState<AppTab>("home");
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
    setCaptureError(null);
    setVisit(null);
    setReviewId(null);
    setTab("home");
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
      imageBase64: visit?.photoBase64,
    });
    if (result.source === "api" && companyId) {
      const rows = await api.getReceipts(companyId).catch(() => null);
      if (rows) setApiReceipts(rows);
    } else {
      setApiReceipts((current) => [
        {
          receiptId: result.receiptId,
          companyId: receipt.companyId,
          merchant: receipt.merchant,
          amountMinor: receipt.amountMinor,
          currency: receipt.currency,
          date: receipt.date,
          status: result.status,
        },
        ...current.filter((row) => row.receiptId !== result.receiptId),
      ]);
    }
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

  async function submitVisit(draft: LocalReceipt) {
    setQueueError(null);
    const queued = {
      ...queueDraft(draft),
      idempotencyKey: draft.idempotencyKey ?? `local-${draft.localId}`,
    };
    setReceipts((current) => [...current, queued]);
    try {
      await send(queued);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Could not submit the receipt";
      setQueueError(message);
      throw new Error(message);
    }
    setVisit(null);
    setTab("home");
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

  async function confirmReview(receiptId: string, transactionId: string) {
    const current = apiReceipts.find((row) => row.receiptId === receiptId);
    if (!current || current.status !== "NeedsReview") return;
    setMatchError(null);
    try {
      const result = await api.confirmMatch({
        store: deviceStore,
        siblings: apiReceipts,
        receipt: current,
        transactionId,
        offline,
      });
      const confirmed = {
        ...current,
        status: result.status,
        matchedTransactionId: result.matchedTransactionId,
      };
      setApiReceipts((rows) => rows.map((row) => (row.receiptId === receiptId ? confirmed : row)));
      setReviewId(null);
      if (companyId) {
        const rows = await api.getReceipts(companyId).catch(() => null);
        if (rows) {
          setApiReceipts(
            rows.map((row) => (row.receiptId === receiptId && row.status !== "Confirmed" ? confirmed : row)),
          );
        }
      }
    } catch (confirmError) {
      setMatchError(confirmError instanceof Error ? confirmError.message : "Could not confirm the match");
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

  async function openCamera() {
    setCaptureError(null);
    try {
      const photo = await takeReceiptPhoto();
      if (!photo) return;
      setTab("capture");
      setVisit({ imageId: DEVICE_PHOTO_ID, photoBase64: photo });
    } catch (cameraError) {
      setTab("capture");
      setCaptureError(
        cameraError instanceof Error ? cameraError.message : "The camera could not be opened.",
      );
    }
  }

  async function uploadPicture() {
    setCaptureError(null);
    try {
      const photo = await chooseReceiptPhoto();
      if (!photo) return;
      setTab("capture");
      setVisit({ imageId: DEVICE_PHOTO_ID, photoBase64: photo });
    } catch (libraryError) {
      setCaptureError(libraryError instanceof Error ? libraryError.message : "That picture could not be read.");
    }
  }

  if (idToken && !listReady) {
    return (
      <SafeAreaView style={styles.centered} edges={["bottom"]}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (idToken) {
    const review = apiReceipts.find((row) => row.receiptId === reviewId && row.status === "NeedsReview");
    return (
      <SafeAreaView style={styles.screen} edges={["bottom"]}>
        <View style={styles.screen}>
          {tab === "home" ? (
            <HomeList
              companyId={companyId}
              receipts={apiReceipts}
              error={listError}
              onReview={(receiptId) => {
                setMatchError(null);
                setReviewId(receiptId);
              }}
            />
          ) : null}
          {tab === "capture" ? (
            <CaptureScreen
              error={captureError}
              onUpload={() => void uploadPicture()}
              onFakeReceipt={(imageId) => {
                setCaptureError(null);
                setVisit({ imageId });
              }}
            />
          ) : null}
          {tab === "profile" ? <ProfileScreen companyId={companyId} onLogout={onLogout} /> : null}
        </View>
        <AppMenu
          tab={tab}
          onHome={() => setTab("home")}
          onCapture={() => {
            setTab("capture");
            void openCamera();
          }}
          onProfile={() => setTab("profile")}
        />
        {visit ? (
          <CaptureSheet onDismiss={() => setVisit(null)}>
            <ReceiptCapture
              companyId={companyId}
              queueError={queueError}
              receipts={receipts}
              onChange={setReceipts}
              onQueue={(localId) => void queueAndSubmit(localId)}
              onConfirm={(localId, transactionId) => void onConfirm(localId, transactionId)}
              matchError={matchError}
              onLogout={onLogout}
              initialImageId={visit.imageId}
              photoBase64={visit.photoBase64}
              onBack={() => setVisit(null)}
              onSubmit={submitVisit}
            />
          </CaptureSheet>
        ) : null}
        {review ? (
          <CaptureSheet onDismiss={() => setReviewId(null)}>
            <ReviewReceipt
              receipt={review}
              siblings={apiReceipts}
              error={matchError}
              onConfirm={(transactionId) => void confirmReview(review.receiptId, transactionId)}
            />
          </CaptureSheet>
        ) : null}
      </SafeAreaView>
    );
  }

  if (showCapture && !queueReady) {
    return (
      <SafeAreaView style={styles.centered} edges={["bottom"]}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (showCapture) {
    return (
      <SafeAreaView style={styles.screen} edges={["bottom"]}>
        <ReceiptCapture
          companyId={companyId}
          queueError={queueError}
          receipts={receipts}
          onChange={setReceipts}
          onQueue={(localId) => void queueAndSubmit(localId)}
          onConfirm={(localId, transactionId) => void onConfirm(localId, transactionId)}
          matchError={matchError}
          onLogout={onLogout}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.centered} edges={["bottom"]}>
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
  screen: { flex: 1, backgroundColor: "#f8f9f7" },
  centered: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f8f9f7",
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
  primary: { backgroundColor: "#0f381f", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  primaryText: { color: "#fff", fontWeight: "600" },
  secondary: {
    borderWidth: 1,
    borderColor: "#0f381f",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  error: { color: "#8a1f1f" },
});
