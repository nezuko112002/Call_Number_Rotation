"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { useTwilioDevice } from "@/hooks/useTwilioDevice";

type TwilioDeviceContextValue = ReturnType<typeof useTwilioDevice>;

const TwilioDeviceContext = createContext<TwilioDeviceContextValue | null>(null);

export function TwilioDeviceProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [authUserId, setAuthUserId] = useState("");
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const isSuperadminRoute = pathname.startsWith("/superadmin");

  useEffect(() => {
    const syncIdentity = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setAuthUserId(user?.id ?? "");
    };

    void syncIdentity();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUserId(session?.user?.id ?? "");
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const identityHint = useMemo(() => {
    if (!authUserId) return "";
    return isSuperadminRoute ? `superadmin-${authUserId}` : `agent-${authUserId}`;
  }, [authUserId, isSuperadminRoute]);

  const value = useTwilioDevice(identityHint, {
    autoAcceptIncoming: isSuperadminRoute,
    muteOnConnect: isSuperadminRoute,
  });

  return <TwilioDeviceContext.Provider value={value}>{children}</TwilioDeviceContext.Provider>;
}

export function useTwilioDeviceContext(): TwilioDeviceContextValue {
  const ctx = useContext(TwilioDeviceContext);
  if (!ctx) {
    throw new Error("useTwilioDeviceContext must be used within TwilioDeviceProvider");
  }
  return ctx;
}
