import { useEffect, useState } from "react";
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
import {
  afterLogout,
  companyIdFromIdToken,
  SECURE_STORE_KEYS,
  signInWithPassword,
} from "../src/cognitoAuth";
import { ReceiptCapture } from "../src/ReceiptCapture";
import type { LocalReceipt } from "../src/receiptDraft";

const region = process.env.EXPO_PUBLIC_COGNITO_REGION ?? "";
const clientId = process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID ?? "";

export default function SignInScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [idToken, setIdToken] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<LocalReceipt[]>([]);
  const [previewCompany, setPreviewCompany] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    SecureStore.getItemAsync(SECURE_STORE_KEYS[0])
      .then((stored) => setIdToken(stored))
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
      setPassword("");
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  async function onLogout() {
    const cleared = afterLogout(receipts);
    await Promise.all(cleared.deleteKeys.map((key) => SecureStore.deleteItemAsync(key)));
    setReceipts(cleared.queue);
    setIdToken(null);
    setPreviewCompany(null);
    setUsername("");
  }

  const showCapture = Boolean(idToken) || Boolean(previewCompany);
  const companyId = idToken ? (companyIdFromIdToken(idToken) ?? "") : (previewCompany ?? "");

  if (busy && !showCapture) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (showCapture) {
    return (
      <View style={styles.screen}>
        <StatusBar style="dark" />
        <ReceiptCapture
          companyId={companyId}
          receipts={receipts}
          onChange={setReceipts}
          onLogout={onLogout}
        />
      </View>
    );
  }

  return (
    <View style={styles.centered}>
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
    </View>
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
