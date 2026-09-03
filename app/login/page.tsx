"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { createClient } from "@/lib/supabase/client";

const MAX_ATTEMPTS = 3;
const LOCKOUT_SECONDS = 60;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (lockedUntil === null) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) {
        setLockedUntil(null);
        setAttempts(0);
        setError(null);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const locked = lockedUntil !== null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (locked) return;

    setPending(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      const next = attempts + 1;
      setAttempts(next);
      // The password is cleared; the email is kept, because retyping it every
      // attempt is friction that punishes the common typo.
      setPassword("");

      if (next >= MAX_ATTEMPTS) {
        setLockedUntil(Date.now() + LOCKOUT_SECONDS * 1000);
        setError(`Too many attempts. Try again in ${LOCKOUT_SECONDS} seconds.`);
      } else {
        const left = MAX_ATTEMPTS - next;
        // Never reveal WHICH field was wrong — that confirms whether an
        // account exists.
        setError(
          `Email or password is incorrect. ${left} attempt${left === 1 ? "" : "s"} left before a 60-second lockout.`,
        );
      }
      setPending(false);
      return;
    }

    router.push(searchParams.get("next") ?? "/clients");
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="w-[340px] rounded-xl border border-border bg-surface p-7 shadow-raised"
    >
      <div aria-hidden className="h-6 w-6 rounded-md bg-accent" />
      <h1 className="mt-3 text-[20px] font-semibold tracking-[-0.01em]">AdFlow</h1>
      <p className="mt-0.5 text-[13px] text-text-secondary">Sign in to continue.</p>

      {error && (
        <p
          role="alert"
          className="mt-[18px] flex gap-1.5 rounded-md border border-danger-border bg-danger-subtle px-2.5 py-2 text-[12px] leading-[1.45] text-danger-on-subtle"
        >
          <span aria-hidden className="font-bold">!</span>
          {locked ? `Too many attempts. Try again in ${secondsLeft} seconds.` : error}
        </p>
      )}

      <div className="mt-[18px] flex flex-col gap-3">
        <Input
          label="Email"
          type="email"
          required
          autoComplete="email"
          value={email}
          disabled={locked}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Password"
          type="password"
          required
          minLength={6}
          autoComplete="current-password"
          value={password}
          disabled={locked}
          error={attempts > 0 ? " " : undefined}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <Button
        type="submit"
        variant="primary"
        disabled={pending || locked}
        className="mt-[18px] h-9 w-full text-[13px] font-semibold"
      >
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-6">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
