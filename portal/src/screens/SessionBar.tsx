import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useSession } from "../providers/session.tsx";

export function SessionBar() {
  const session = useSession();
  const [open, setOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const company = session.companyId ?? "Unknown company";

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!accountRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="bar">
      <Link className="bar-title" to="/">
        Receipt review
      </Link>
      <div className="account" ref={accountRef}>
        <button
          type="button"
          className="account-button"
          aria-label="Account"
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => setOpen((value) => !value)}
        >
          <UserIcon />
        </button>
        {open ? (
          <div className="account-menu" role="menu">
            <p>Logged in as</p>
            <strong>{company}</strong>
            <button type="button" role="menuitem" onClick={session.logOut}>
              Log out
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5 19.2c1.4-3 3.8-4.4 7-4.4s5.6 1.4 7 4.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
