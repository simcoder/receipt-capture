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
  type QueuedReceipt,
} from "../src/cognitoAuth";

const region = process.env.EXPO_PUBLIC_COGNITO_REGION ?? "";
const clientId = process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID ?? "";

export default function SignInScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [idToken, setIdToken] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueuedReceipt[]>([]);
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
    const cleared = afterLogout(queue);
    await Promise.all(cleared.deleteKeys.map((key) => SecureStore.deleteItemAsync(key)));
    setQueue(cleared.queue);
    setIdToken(null);
    setUsername("");
  }

  function holdLocalReceipt() {
    if (!idToken) return;
    const companyId = companyIdFromIdToken(idToken) ?? "unknown";
    setQueue((current) => [
      ...current,
      { localId: `local-${current.length + 1}`, companyId },
    ]);
  }

  if (busy && !idToken) {
    return (
      <View style={styles.screen}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <Text style={styles.title}>Receipt capture</Text>
      {idToken ? (
        <View style={styles.block}>
          <Text style={styles.label}>Signed in</Text>
          <Text>{companyIdFromIdToken(idToken) ?? "No company claim"}</Text>
          <Text style={styles.label}>Local queue</Text>
          <Text>{queue.length === 0 ? "Empty" : queue.map((item) => item.localId).join(", ")}</Text>
          <Pressable style={styles.secondary} onPress={holdLocalReceipt}>
            <Text>Hold a local receipt</Text>
          </Pressable>
          <Pressable style={styles.primary} onPress={onLogout}>
            <Text style={styles.primaryText}>Log out</Text>
          </Pressable>
        </View>
      ) : (
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
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#f7f7f5" },
  title: { fontSize: 28, fontWeight: "600", marginBottom: 24 },
  block: { gap: 12 },
  label: { fontSize: 13, color: "#555" },
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
