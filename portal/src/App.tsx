import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import type { PortalConfig } from "./config.ts";
import { SessionProvider, useSession } from "./providers/session.tsx";
import { ReceiptDetail } from "./screens/ReceiptDetail.tsx";
import { ReceiptTable } from "./screens/ReceiptTable.tsx";
import { SessionBar } from "./screens/SessionBar.tsx";
import { SignIn } from "./screens/SignIn.tsx";

function Gate() {
  const session = useSession();
  if (!session.idToken) return <SignIn />;
  return (
    <>
      <SessionBar />
      <Routes>
        <Route path="/" element={<ReceiptTable />} />
        <Route path="/receipts/:receiptId" element={<ReceiptDetail />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export function App(props: { config: PortalConfig }) {
  return (
    <SessionProvider config={props.config}>
      <BrowserRouter>
        <Gate />
      </BrowserRouter>
    </SessionProvider>
  );
}
