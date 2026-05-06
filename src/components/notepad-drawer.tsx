"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

const SAVE_DEBOUNCE_MS = 600;
const STORAGE_PREFIX = "notes:";

export function NotepadDrawer() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [userId, setUserId] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const lastSavedContentRef = useRef<string>("");
  const skipNextSaveRef = useRef<boolean>(true);

  const storageKey = userId ? `${STORAGE_PREFIX}${userId}` : null;

  useEffect(() => {
    let isCancelled = false;

    const bootstrap = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (isCancelled) return;
      if (!user?.id) {
        setIsReady(false);
        return;
      }
      setUserId(user.id);
    };

    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUserId = session?.user?.id ?? null;
      setUserId(nextUserId);
      if (!nextUserId) {
        setContent("");
        setIsReady(false);
        setStatus("idle");
        lastSavedContentRef.current = "";
      }
    });

    return () => {
      isCancelled = true;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!userId || !storageKey) return;

    skipNextSaveRef.current = true;

    const cached = typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null;
    if (cached !== null) {
      lastSavedContentRef.current = cached;
      // Defer hydration update to avoid synchronous setState inside effect body.
      window.setTimeout(() => {
        setContent(cached);
      }, 0);
    }

    const fetchRemote = async () => {
      try {
        const res = await fetch(`/api/notes?user_id=${encodeURIComponent(userId)}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load notes");

        const remoteContent: string = typeof json.content === "string" ? json.content : "";
        const remoteUpdatedAt: string | null = json.updated_at ?? null;

        if (cached === null || remoteContent !== cached) {
          skipNextSaveRef.current = true;
          setContent(remoteContent);
          lastSavedContentRef.current = remoteContent;
          if (typeof window !== "undefined") {
            window.localStorage.setItem(storageKey, remoteContent);
          }
        }

        if (remoteUpdatedAt) {
          setLastSavedAt(new Date(remoteUpdatedAt));
          setStatus("saved");
        } else {
          setStatus("idle");
        }
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Failed to load notes");
        setStatus("error");
      } finally {
        setIsReady(true);
      }
    };

    void fetchRemote();
  }, [userId, storageKey]);

  const persist = useCallback(
    async (next: string) => {
      if (!userId) return;
      setStatus("saving");
      setErrorMessage(null);
      try {
        const res = await fetch("/api/notes", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId, content: next }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to save notes");
        lastSavedContentRef.current = next;
        setLastSavedAt(json.updated_at ? new Date(json.updated_at) : new Date());
        setStatus("saved");
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Failed to save notes");
        setStatus("error");
      }
    },
    [userId],
  );

  useEffect(() => {
    if (!isReady || !userId || !storageKey) return;

    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, content);
    }

    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }

    if (content === lastSavedContentRef.current) {
      return;
    }

    setStatus("dirty");

    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      void persist(content);
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [content, isReady, userId, storageKey, persist]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const isToggleShortcut = (event.ctrlKey || event.metaKey) && event.key === "/";
      if (isToggleShortcut) {
        event.preventDefault();
        setIsOpen((prev) => !prev);
        return;
      }
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const id = window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 80);
    return () => window.clearTimeout(id);
  }, [isOpen]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (status === "dirty" || status === "saving") {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [status]);

  const flushSave = useCallback(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (content !== lastSavedContentRef.current) {
      void persist(content);
    }
  }, [content, persist]);

  const statusLabel = (() => {
    if (status === "saving") return "Saving...";
    if (status === "dirty") return "Unsaved";
    if (status === "error") return "Save failed";
    if (status === "saved" && lastSavedAt) {
      return `Saved ${lastSavedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
    }
    return "Ready";
  })();

  const statusTone = (() => {
    if (status === "saving") return "bg-indigo-50 text-indigo-700 border-indigo-100";
    if (status === "dirty") return "bg-amber-50 text-amber-700 border-amber-100";
    if (status === "error") return "bg-rose-50 text-rose-700 border-rose-100";
    if (status === "saved") return "bg-emerald-50 text-emerald-700 border-emerald-100";
    return "bg-slate-50 text-slate-600 border-slate-200";
  })();

  const charCount = content.length;
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const hasUnsaved = status === "dirty" || status === "saving";

  if (!userId) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Open notes"
        title="Notes (Ctrl + /)"
        onClick={() => setIsOpen((prev) => !prev)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-indigo-100 bg-white text-indigo-700 shadow-lg ring-1 ring-slate-900/5 transition hover:-translate-y-0.5 hover:bg-indigo-50 hover:text-indigo-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-6 w-6"
          aria-hidden="true"
        >
          <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H18a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 19.5Z" />
          <path d="M8 7h8" />
          <path d="M8 11h8" />
          <path d="M8 15h5" />
        </svg>
        {hasUnsaved ? (
          <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-white" />
        ) : null}
      </button>

      <div
        className={`fixed inset-0 z-50 transition ${isOpen ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!isOpen}
      >
        <div
          onClick={() => {
            flushSave();
            setIsOpen(false);
          }}
          className={`absolute inset-0 bg-slate-900/30 backdrop-blur-sm transition-opacity duration-200 ${
            isOpen ? "opacity-100" : "opacity-0"
          }`}
        />

        <aside
          role="dialog"
          aria-label="Notes"
          aria-modal="true"
          className={`absolute right-0 top-0 flex h-full w-full max-w-[420px] flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-200 ease-out ${
            isOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Workspace</p>
              <h2 className="text-lg font-semibold text-slate-900">Notes</h2>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    status === "saving"
                      ? "bg-indigo-500 animate-pulse"
                      : status === "dirty"
                        ? "bg-amber-500"
                        : status === "error"
                          ? "bg-rose-500"
                          : status === "saved"
                            ? "bg-emerald-500"
                            : "bg-slate-400"
                  }`}
                />
                {statusLabel}
              </span>
              <button
                type="button"
                aria-label="Close notes"
                onClick={() => {
                  flushSave();
                  setIsOpen(false);
                }}
                className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
          </header>

          {errorMessage && status === "error" ? (
            <div className="border-b border-rose-100 bg-rose-50 px-5 py-2 text-xs font-medium text-rose-700">
              {errorMessage}
            </div>
          ) : null}

          <div className="flex-1 overflow-hidden p-4">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onBlur={flushSave}
              placeholder="Jot down anything: call notes, reminders, scripts. Auto-saved as you type."
              spellCheck
              disabled={!isReady}
              className="h-full w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-200 disabled:cursor-wait disabled:opacity-60"
            />
          </div>

          <footer className="flex items-center justify-between border-t border-slate-200 px-5 py-3 text-xs text-slate-500">
            <span>
              {wordCount} {wordCount === 1 ? "word" : "words"} &middot; {charCount} {charCount === 1 ? "char" : "chars"}
            </span>
            <span className="hidden sm:inline">
              <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                Ctrl
              </kbd>{" "}
              +{" "}
              <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                /
              </kbd>{" "}
              to toggle
            </span>
          </footer>
        </aside>
      </div>
    </>
  );
}
