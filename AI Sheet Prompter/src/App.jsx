import React, { useState, useEffect, useRef } from "react";
import { fetchPrompts } from "../utils/sheets.js";
import { puter } from "@heyputer/puter.js";
import { getDirectoryHandle, saveDirectoryHandle, clearDirectoryHandle } from "./lib/db.js";
import { getHistoryState, saveHistoryState, clearHistoryState } from "../utils/storage.js";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

export default function App() {
  // Config state
  const [selectedTarget, setSelectedTarget] = useState("gemini");
  const [sheetUrl, setSheetUrl] = useState("https://docs.google.com/spreadsheets/d/1wenNpm8gGTPl0KWUHAiaZtLI29QoW6of4Y_skIcCMy8/edit?gid=0#gid=0");
  const [tabName, setTabName] = useState("Sheet1");
  const [columnLetter, setColumnLetter] = useState("B");
  const [delaySeconds, setDelaySeconds] = useState(5);

  // Status/Loaded prompts state
  const [loadedPrompts, setLoadedPrompts] = useState([]);
  const [promptCountText, setPromptCountText] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  // Progress state
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressText, setProgressText] = useState("");

  // Status feedback state
  const [status, setStatus] = useState(null); // { text, type: 'error' | 'success' | 'info' }

  // Resumable progress state
  const [savedProgress, setSavedProgress] = useState(null); // { currentIndex, promptsCount }

  // Puter.js custom queue states
  const puterCancelRef = useRef(false);
  const [sessionImages, setSessionImages] = useState([]);
  const [isPopupView, setIsPopupView] = useState(true);
  const [isPuterSignedIn, setIsPuterSignedIn] = useState(false);
  const [puterToken, setPuterToken] = useState("");
  const [directoryHandle, setDirectoryHandle] = useState(null);
  const [isDirPermissionGranted, setIsDirPermissionGranted] = useState(false);
  const [puterRatio, setPuterRatio] = useState("1:1");

  // Sync Puter auth state on load/target change
  useEffect(() => {
    if (selectedTarget === "puter") {
      const checkAuth = () => {
        setIsPuterSignedIn(puter.auth.isSignedIn());
      };
      checkAuth();
      // Check again after 500ms and 1500ms to catch async init
      const t1 = setTimeout(checkAuth, 500);
      const t2 = setTimeout(checkAuth, 1500);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [selectedTarget]);

  // 1. Initial State Sync
  useEffect(() => {
    setIsPopupView(window.innerWidth <= 400);

    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
      // Restore persisted config
      chrome.storage.sync.get(["targetAI", "sheetUrl", "tabName", "columnLetter", "delaySeconds", "puterToken", "puterRatio"], (result) => {
        if (result.targetAI) {
          setSelectedTarget(result.targetAI);
          updateThemeClass(result.targetAI);
        }
        if (result.puterToken) {
          setPuterToken(result.puterToken);
          puter.setAuthToken(result.puterToken);
          setIsPuterSignedIn(true);
        }
        if (result.sheetUrl) setSheetUrl(result.sheetUrl);
        if (result.tabName) setTabName(result.tabName);
        if (result.columnLetter) setColumnLetter(result.columnLetter);
        if (result.delaySeconds) setDelaySeconds(result.delaySeconds);
        if (result.puterRatio) setPuterRatio(result.puterRatio);
      });

      // Check if queue is running currently
      chrome.runtime.sendMessage({ action: "getState" }, (response) => {
        if (chrome.runtime.lastError) return;
        const state = response?.state;
        if (state && state.prompts && state.prompts.length > 0) {
          setLoadedPrompts(state.prompts);
          if (state.targetAI) {
            setSelectedTarget(state.targetAI);
            updateThemeClass(state.targetAI);
          }
          const totalProgress = state.prompts.length;
          if (state.running) {
            setIsRunning(true);
            const currentProgress = state.currentIndex + 1;
            setProgressPercent(Math.round((currentProgress / totalProgress) * 100));
            const aiName = state.targetAI === "chatgpt" ? "ChatGPT" : "Gemini";
            setProgressText(`Sending prompt ${currentProgress} of ${totalProgress} to ${aiName}…`);
          } else {
            setIsRunning(false);
            if (state.currentIndex >= totalProgress) {
              setProgressPercent(100);
              setProgressText(`All ${totalProgress} prompts completed.`);
            } else {
              const pct = Math.round((state.currentIndex / totalProgress) * 100);
              setProgressPercent(pct);
              setProgressText(`Stopped at prompt ${state.currentIndex + 1} of ${totalProgress}`);
            }
          }
        }
      });
    }
  }, []);

  // Fetch and check saved progress history when inputs or prompts load/change
  useEffect(() => {
    if (sheetUrl && tabName && loadedPrompts.length > 0) {
      getHistoryState(sheetUrl, tabName).then((history) => {
        if (history && history.currentIndex > 0 && history.currentIndex < history.promptsCount && history.promptsCount === loadedPrompts.length) {
          setSavedProgress(history);
        } else {
          setSavedProgress(null);
        }
      }).catch(() => setSavedProgress(null));
    } else {
      setSavedProgress(null);
    }
  }, [sheetUrl, tabName, loadedPrompts, isRunning]);

  // 2. Message Listener from Background Worker
  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
      const listener = (msg) => {
        switch (msg.action) {
          case "progress":
            const pct = Math.round((msg.current / msg.total) * 100);
            setProgressPercent(pct);
            const aiName = selectedTarget === "chatgpt" ? "ChatGPT" : "Gemini";
            setProgressText(`Sending prompt ${msg.current} of ${msg.total} to ${aiName}…`);
            setStatus(null);
            break;

          case "allDone":
            setIsRunning(false);
            setProgressPercent(100);
            setProgressText(`All ${loadedPrompts.length || msg.total || ""} prompts completed.`);
            setStatus({ text: "✓ All prompts complete!", type: "success" });
            break;

          case "stopped":
            setIsRunning(false);
            setProgressText((prev) => {
              if (!prev) return "Stopped.";
              return prev.replace("Sending", "Stopped at").replace(/to (ChatGPT|Gemini)…?/, "").trim();
            });
            setStatus((prev) => (prev && prev.type === "error" ? prev : { text: "Stopped.", type: "info" }));
            break;

          case "error":
            setStatus({ text: msg.message, type: "error" });
            break;
        }
      };

      chrome.runtime.onMessage.addListener(listener);
      return () => chrome.runtime.onMessage.removeListener(listener);
    }
  }, [selectedTarget, loadedPrompts]);

  const resetUI = () => {
    setIsRunning(false);
    setProgressPercent(0);
    setProgressText("");
  };

  const updateThemeClass = (target) => {
    document.body.classList.toggle("chatgpt-theme", target === "chatgpt");
    document.body.classList.toggle("gemini-theme", target === "gemini");
    document.body.classList.toggle("puter-theme", target === "puter");
  };

  const handleTargetChange = (val) => {
    if (isRunning) return;
    setSelectedTarget(val);
    updateThemeClass(val);
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ targetAI: val });
    }
  };

  const openInTab = () => {
    if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") });
    }
  };

  const handlePuterTokenChange = (val) => {
    const trimmed = val.trim();
    setPuterToken(trimmed);
    if (trimmed) {
      puter.setAuthToken(trimmed);
      const signedIn = puter.auth.isSignedIn();
      setIsPuterSignedIn(signedIn);
    } else {
      puter.setAuthToken("");
      setIsPuterSignedIn(false);
    }
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ puterToken: trimmed });
    }
  };

  const handlePuterLogin = async () => {
    try {
      setStatus(null);
      await puter.auth.signIn();
      const signedIn = puter.auth.isSignedIn();
      setIsPuterSignedIn(signedIn);
      if (signedIn) {
        const token = puter.authToken;
        setPuterToken(token || "");
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync && token) {
          chrome.storage.sync.set({ puterToken: token });
        }
        setStatus({ text: "✓ Successfully signed in to Puter!", type: "success" });
      }
    } catch (err) {
      console.error("Login failed:", err);
      setStatus({ text: `Puter login failed: ${err.message}`, type: "error" });
    }
  };

  const handlePuterLogout = () => {
    puter.auth.signOut();
    setPuterToken("");
    setIsPuterSignedIn(false);
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ puterToken: "" });
    }
    setStatus({ text: "Signed out of Puter.", type: "info" });
  };

  const handleRatioChange = (val) => {
    setPuterRatio(val);
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ puterRatio: val });
    }
  };

  // Load Output Directory Handle from IndexedDB
  useEffect(() => {
    const loadDir = async () => {
      try {
        const handle = await getDirectoryHandle();
        if (handle) {
          setDirectoryHandle(handle);
          const permission = await handle.queryPermission({ mode: "readwrite" });
          setIsDirPermissionGranted(permission === "granted");
        }
      } catch (err) {
        console.warn("Failed to load output directory:", err);
      }
    };
    loadDir();
  }, []);

  const handleSelectDirectory = async () => {
    try {
      setStatus(null);
      const handle = await window.showDirectoryPicker({
        mode: "readwrite",
      });
      setDirectoryHandle(handle);
      setIsDirPermissionGranted(true);
      await saveDirectoryHandle(handle);
      setStatus({ text: `✓ Output location set to: ${handle.name}`, type: "success" });
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("Directory picker error:", err);
        setStatus({ text: `Failed to set directory: ${err.message}`, type: "error" });
      }
    }
  };

  const handleClearDirectory = async () => {
    try {
      setDirectoryHandle(null);
      setIsDirPermissionGranted(false);
      await clearDirectoryHandle();
      setStatus({ text: "Custom output directory cleared. Reverting to Downloads.", type: "info" });
    } catch (err) {
      console.error("Failed to clear directory:", err);
    }
  };

  const handleRequestDirectoryPermission = async () => {
    if (!directoryHandle) return;
    try {
      setStatus(null);
      const permission = await directoryHandle.requestPermission({ mode: "readwrite" });
      if (permission === "granted") {
        setIsDirPermissionGranted(true);
        setStatus({ text: "✓ Output directory access verified.", type: "success" });
      } else {
        setIsDirPermissionGranted(false);
        setStatus({ text: "Output directory access denied.", type: "error" });
      }
    } catch (err) {
      console.error("Failed to request directory permission:", err);
      setStatus({ text: `Failed to verify access: ${err.message}`, type: "error" });
    }
  };

  // 3. Load Prompts
  const handleLoadPrompts = async () => {
    const url = sheetUrl.trim();
    if (!url) {
      setStatus({ text: "Please enter a Google Sheet URL.", type: "error" });
      return;
    }

    const tab = tabName.trim() || "Sheet1";
    const column = columnLetter.trim() || "B";
    const delaySec = parseInt(delaySeconds, 10) || 5;

    // Persist current config
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({
        sheetUrl: url,
        tabName: tab,
        columnLetter: column,
        delaySeconds: delaySec,
      });
    }

    setIsLoading(true);
    setStatus(null);
    setPromptCountText(null);

    try {
      const prompts = await fetchPrompts(url, tab, column);
      setLoadedPrompts(prompts);

      if (prompts.length === 0) {
        setStatus({
          text: `No prompts found in column "${column}". Check your sheet.`,
          type: "error",
        });
      } else {
        setPromptCountText(
          `${prompts.length} prompt${prompts.length !== 1 ? "s" : ""} loaded`
        );
        setProgressPercent(0);
        setProgressText(`0 of ${prompts.length} prompts sent`);
      }
    } catch (err) {
      setStatus({ text: err.message, type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Start processing
  // Puter queue execution logic
  const runPuterQueue = async (delaySec, startIndex = 0) => {
    setIsRunning(true);
    setStatus(null);
    setProgressPercent(0);
    setProgressText("Initializing Puter.js…");
    puterCancelRef.current = false;

    let index = startIndex;
    const total = loadedPrompts.length;

    if (startIndex > 0) {
      setProgressPercent(Math.round((startIndex / total) * 100));
      setProgressText(`Resuming image generation at ${startIndex + 1} of ${total} via Puter.js…`);
    }

    while (index < total) {
      if (puterCancelRef.current) {
        setIsRunning(false);
        setStatus({ text: "Stopped.", type: "info" });
        return;
      }

      const prompt = loadedPrompts[index];
      const currentProgress = index + 1;
      setProgressPercent(Math.round((currentProgress / total) * 100));
      setProgressText(`Generating image ${currentProgress} of ${total} via Puter.js…`);

      try {
        // Parse aspect ratio options
        const ratioParts = puterRatio.split(":");
        const w = parseInt(ratioParts[0], 10);
        const h = parseInt(ratioParts[1], 10);
        const ratioOptions = (!isNaN(w) && !isNaN(h)) ? { ratio: { w, h } } : {};

        // Generate image via Puter
        const imgElement = await puter.ai.txt2img(prompt, { 
          model: "gpt-image-2",
          ...ratioOptions
        });
        const imageUrl = imgElement.src;

        // Add to gallery previews
        setSessionImages((prev) => [imageUrl, ...prev]);

        // Download image automatically
        if (directoryHandle && isDirPermissionGranted) {
          try {
            const res = await fetch(imageUrl);
            const blob = await res.blob();
            const cleanPrompt = prompt.slice(0, 30).replace(/[^a-zA-Z0-9_-]/g, "_");
            const filename = `img_${currentProgress}_${cleanPrompt || Date.now()}.png`;

            const fileHandle = await directoryHandle.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
            console.log(`Saved image direct to local folder: ${filename}`);
          } catch (writeErr) {
            console.error("Failed to write to folder, falling back to chrome downloads:", writeErr);
            if (typeof chrome !== "undefined" && chrome.downloads && chrome.downloads.download) {
              chrome.downloads.download({
                url: imageUrl,
                filename: `puter-image-${Date.now()}-${currentProgress}.png`,
                saveAs: false,
              });
            }
          }
        } else {
          if (typeof chrome !== "undefined" && chrome.downloads && chrome.downloads.download) {
            chrome.downloads.download({
              url: imageUrl,
              filename: `puter-image-${Date.now()}-${currentProgress}.png`,
              saveAs: false,
            }, () => {
              if (chrome.runtime.lastError) {
                console.warn("Download issue:", chrome.runtime.lastError.message);
              }
            });
          }
        }
      } catch (err) {
        console.error("Puter generation error:", err);
        setStatus({
          text: `Puter.js error on prompt ${currentProgress}: ${err.message}`,
          type: "error",
        });
        // Wait 2s to allow user to see error before moving to next
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      index++;
      if (sheetUrl && tabName) {
        if (index >= total) {
          await clearHistoryState(sheetUrl, tabName);
        } else {
          await saveHistoryState(sheetUrl, tabName, {
            currentIndex: index,
            promptsCount: total
          });
        }
      }

      if (index < total && !puterCancelRef.current) {
        // Countdown delay
        for (let s = 0; s < delaySec; s++) {
          if (puterCancelRef.current) break;
          setProgressText(`Waiting ${delaySec - s}s before next image…`);
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }

    setIsRunning(false);
    setProgressPercent(100);
    setProgressText(`All ${total} images generated.`);
    setStatus({ text: "✓ Puter generation complete!", type: "success" });
  };

  const handleStart = async (startIndex = 0) => {
    if (loadedPrompts.length === 0) return;

    const delaySec = Math.max(0, parseInt(delaySeconds, 10) || 5);
    const delayMs = delaySec * 1000;

    // Persist config on start
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({
        sheetUrl: sheetUrl.trim(),
        tabName: tabName.trim() || "Sheet1",
        columnLetter: columnLetter.trim() || "B",
        delaySeconds: delaySec,
      });
    }

    // Clear history if starting fresh
    if (startIndex === 0 && sheetUrl && tabName) {
      await clearHistoryState(sheetUrl, tabName);
      setSavedProgress(null);
    }

    if (selectedTarget === "puter") {
      // If output directory handle is saved but permission is not yet active, prompt for it
      if (directoryHandle && !isDirPermissionGranted) {
        try {
          const status = await directoryHandle.requestPermission({ mode: "readwrite" });
          if (status === "granted") {
            setIsDirPermissionGranted(true);
          } else {
            setStatus({ text: "Please verify directory permissions or clear output folder selection to run the queue.", type: "error" });
            return;
          }
        } catch (err) {
          console.error("Failed to request directory permission:", err);
          setStatus({ text: `Failed to request directory permission: ${err.message}`, type: "error" });
          return;
        }
      }
      runPuterQueue(delaySec, startIndex);
      return;
    }

    chrome.runtime.sendMessage(
      {
        action: "start",
        prompts: loadedPrompts,
        delay: delayMs,
        targetAI: selectedTarget,
        sheetUrl: sheetUrl.trim(),
        tabName: tabName.trim(),
        startIndex: startIndex,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          setStatus({
            text: "Failed to start: " + chrome.runtime.lastError.message,
            type: "error",
          });
          return;
        }
        if (response && !response.ok) {
          setStatus({
            text: response.error || "Failed to start processing",
            type: "error",
          });
          return;
        }
        setIsRunning(true);
        const nextPromptNum = startIndex + 1;
        setProgressPercent(Math.round((nextPromptNum / loadedPrompts.length) * 100));
        const aiName = selectedTarget === "chatgpt" ? "ChatGPT" : "Gemini";
        setProgressText(`Sending prompt ${nextPromptNum} of ${loadedPrompts.length} to ${aiName}…`);
        setStatus(null);
      }
    );
  };

  // 5. Stop processing
  const handleStop = () => {
    if (selectedTarget === "puter") {
      puterCancelRef.current = true;
      setIsRunning(false);
      setProgressText("Stopped.");
      setStatus({ text: "Stopped.", type: "info" });
      return;
    }

    chrome.runtime.sendMessage({ action: "stop" }, () => {
      setIsRunning(false);
      setProgressText((prev) => {
        if (!prev) return "Stopped.";
        return prev.replace("Sending", "Stopped at").replace(/to (ChatGPT|Gemini)…?/, "").trim();
      });
      setStatus({ text: "Stopped.", type: "info" });
    });
  };

  return (
    <Card className="w-full" role="main">
      {/* Header */}
      <CardHeader>
        <div className="w-7 h-7 rounded bg-white/[0.02] border border-border text-accent flex items-center justify-center flex-shrink-0 transition-colors duration-200 ease-out" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <CardTitle>AI Sheet Prompter</CardTitle>
        {isPopupView && (
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto w-7 h-7 text-secondary hover:text-primary hover:bg-white/[0.04] active:scale-[0.97]"
            onClick={openInTab}
            title="Open in persistent tab"
            aria-label="Open in tab"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </Button>
        )}
      </CardHeader>

      {/* Puter.js Authentication Status Box */}
      {selectedTarget === "puter" && (
        <div className="flex flex-col gap-2.5 p-3 bg-slate-950/40 border border-border rounded-md animate-fade-in text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isPuterSignedIn ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"}`} />
              <span className="font-medium text-secondary">
                Puter.js: <span className={`font-semibold ${isPuterSignedIn ? "text-emerald-400" : "text-red-400"}`}>{isPuterSignedIn ? "Logged In" : "Not Logged In"}</span>
              </span>
            </div>
            {isPuterSignedIn && (
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground active:scale-[0.97]"
                onClick={handlePuterLogout}
              >
                Sign Out
              </Button>
            )}
          </div>

          {!isPuterSignedIn && (
            <div className="flex flex-col gap-2 border-t border-border/40 pt-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-secondary font-medium">Authentication Token</span>
                <a
                  href="https://puter.com/dashboard#account"
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent hover:underline flex items-center gap-0.5"
                >
                  Get Auth Token
                  <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              </div>
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="Paste puter_auth_token here..."
                  value={puterToken}
                  onChange={(e) => handlePuterTokenChange(e.target.value)}
                  className="h-8 text-[11px] flex-1 bg-slate-950/60"
                  spellCheck="false"
                  autoComplete="off"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-[11px] active:scale-[0.97]"
                  onClick={handlePuterLogin}
                  title="Try standard login popups"
                >
                  Sign In
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Target AI Selector (Shadcn UI Select) */}
      <Field className="w-full">
        <FieldLabel>Target AI</FieldLabel>
        <Select
          value={selectedTarget}
          onValueChange={handleTargetChange}
          disabled={isRunning}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select Target AI" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="gemini">
                <div className="flex flex-col items-start text-left py-0.5">
                  <span className="flex items-center gap-2 font-medium text-foreground">
                    <svg className="w-3.5 h-3.5 text-blue-400" viewBox="0 0 28 28" fill="currentColor" aria-hidden="true">
                      <path d="M14 28C14 26.0633 13.6267 24.2433 12.88 22.54C12.1567 20.8367 11.165 19.355 9.905 18.095C8.645 16.835 7.16333 15.8433 5.46 15.12C3.75667 14.3733 1.93667 14 0 14C1.93667 14 3.75667 13.6383 5.46 12.915C7.16333 12.1683 8.645 11.165 9.905 9.905C11.165 8.645 12.1567 7.16333 12.88 5.46C13.6267 3.75667 14 1.93667 14 0C14 1.93667 14.3617 3.75667 15.085 5.46C15.8317 7.16333 16.835 8.645 18.095 9.905C19.355 11.165 20.8367 12.1683 22.54 12.915C24.2433 13.6383 26.0633 14 28 14C26.0633 14 24.2433 14.3733 22.54 15.12C20.8367 15.8433 19.355 16.835 18.095 18.095C16.835 19.355 15.8317 20.8367 15.085 22.54C14.3617 24.2433 14 26.0633 14 28Z" />
                    </svg>
                    Gemini
                  </span>
                  <span className="text-[10px] text-muted-foreground pl-[22px] mt-0.5">
                    Output: Gemini Tab (Chat Feed)
                  </span>
                </div>
              </SelectItem>
              <SelectItem value="chatgpt">
                <div className="flex flex-col items-start text-left py-0.5">
                  <span className="flex items-center gap-2 font-medium text-foreground">
                    <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M9.205 8.658v-2.26c0-.19.072-.333.238-.428l4.543-2.616c.619-.357 1.356-.523 2.117-.523 2.854 0 4.662 2.212 4.662 4.566 0 .167 0 .357-.024.547l-4.71-2.759a.797.797 0 00-.856 0l-5.97 3.473zm10.609 8.8V12.06c0-.333-.143-.57-.429-.737l-5.97-3.473 1.95-1.118a.433.433 0 01.476 0l4.543 2.617c1.309.76 2.189 2.378 2.189 3.948 0 1.808-1.07 3.473-2.76 4.163zM7.802 12.703l-1.95-1.142c-.167-.095-.239-.238-.239-.428V5.899c0-2.545 1.95-4.472 4.591-4.472 1 0 1.927.333 2.712.928L8.23 5.067c-.285.166-.428.404-.428.737v6.898zM12 15.128l-2.795-1.57v-3.33L12 8.658l2.795 1.57v3.33L12 15.128zm1.796 7.23c-1 0-1.927-.332-2.712-.927l4.686-2.712c.285-.166.428-.404.428-.737v-6.898l1.974 1.142c.167.095.238.238.238.428v5.233c0 2.545-1.974 4.472-4.614 4.472zm-5.637-5.303l-4.544-2.617c-1.308-.761-2.188-2.378-2.188-3.948A4.482 4.482 0 014.21 6.327v5.423c0 .333.143.571.428.738l5.947 3.449-1.95 1.118a.432.432 0 01-.476 0zm-.262 3.9c-2.688 0-4.662-2.021-4.662-4.519 0-.19.024-.38.047-.57l4.686 2.71c.286.167.571.167.856 0l5.97-3.448v2.26c0 .19-.07.333-.237.428l-4.543 2.616c-.619.357-1.356.523-2.117.523zm5.899 2.83a5.947 5.947 0 005.827-4.756C22.287 18.339 24 15.84 24 13.296c0-1.665-.713-3.282-1.998-4.448.119-.5.19-.999.19-1.498 0-3.401-2.759-5.947-5.946-5.947-.642 0-1.26.095-1.88.31A5.962 5.962 0 0010.205 0a5.947 5.947 0 00-5.827 4.757C1.713 5.447 0 7.945 0 10.49c0 1.666.713 3.283 1.998 4.448-.119.5-.19 1-.19 1.499 0 3.401 2.759 5.946 5.946 5.946.642 0 1.26-.095 1.88-.309a5.96 5.96 0 004.162 1.713z" />
                    </svg>
                    ChatGPT
                  </span>
                  <span className="text-[10px] text-muted-foreground pl-[22px] mt-0.5">
                    Output: ChatGPT Tab (Chat Feed)
                  </span>
                </div>
              </SelectItem>
              <SelectItem value="puter">
                <div className="flex flex-col items-start text-left py-0.5">
                  <span className="flex items-center gap-2 font-medium text-foreground">
                    <svg className="w-3.5 h-3.5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    Puter.js (Image Gen)
                  </span>
                  <span className="text-[10px] text-muted-foreground pl-[22px] mt-0.5">
                    Output: Browser Downloads (Silent PNG)
                  </span>
                </div>
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground mt-1.5 leading-normal">
          {selectedTarget === "gemini" && "Output Location: Gemini Tab (Chat Feed)"}
          {selectedTarget === "chatgpt" && "Output Location: ChatGPT Tab (Chat Feed)"}
          {selectedTarget === "puter" && `Output Location: ${directoryHandle ? `Direct Write ("${directoryHandle.name}" folder)` : "Browser Downloads Folder (Silent PNG)"}`}
        </p>
      </Field>

      {/* Puter Output Folder Selector Box */}
      {selectedTarget === "puter" && (
        <div className="flex flex-col gap-3.5 p-3 bg-slate-950/40 border border-border rounded-md animate-fade-in text-xs">
          {/* Custom Output Folder Section */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-secondary">Custom Output Folder</span>
              {directoryHandle ? (
                <span className={`text-[10px] border px-1.5 py-0.5 rounded flex items-center gap-1 font-medium ${isDirPermissionGranted ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isDirPermissionGranted ? "bg-emerald-400 animate-pulse" : "bg-amber-400 animate-pulse"}`} />
                  {isDirPermissionGranted ? "Permission: Granted" : "Permission: Required"}
                </span>
              ) : (
                <span className="text-[10px] bg-slate-900 text-muted-foreground border border-border px-1.5 py-0.5 rounded flex items-center gap-1 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60" />
                  Browser Default
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <Input
                type="text"
                readOnly
                value={directoryHandle ? directoryHandle.name : "Default Downloads Folder"}
                className="h-8 text-[11px] flex-1 bg-slate-950/60 font-mono text-muted-foreground cursor-default"
                spellCheck="false"
                autoComplete="off"
              />
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-[11px] active:scale-[0.97] border-accent/20 hover:bg-accent/5 hover:border-accent/40"
                onClick={handleSelectDirectory}
                title="Select a local folder on your computer"
              >
                Browse...
              </Button>
              {directoryHandle && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  onClick={handleClearDirectory}
                  title="Reset to default downloads folder"
                >
                  ✕
                </Button>
              )}
            </div>

            {directoryHandle && !isDirPermissionGranted && (
              <div className="flex flex-col gap-1.5 border-t border-border/40 pt-2 mt-1">
                <p className="text-[10px] text-amber-400/90 leading-normal">
                  Browser security requires verification to write directly to folders across sessions.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-7 text-[11px] border-amber-500/30 text-amber-300 hover:bg-amber-500/10 hover:border-amber-500/50"
                  onClick={handleRequestDirectoryPermission}
                >
                  Verify Folder Access
                </Button>
              </div>
            )}

            <p className="text-[10px] text-muted-foreground leading-normal mt-0.5">
              {directoryHandle
                ? `Images will save directly to your custom local folder "${directoryHandle.name}" as clean png files.`
                : "No folder selected. Images will download directly to your browser's default Downloads directory."}
            </p>
          </div>

          {/* Aspect Ratio Selector Section */}
          <div className="flex flex-col gap-1.5 border-t border-border/40 pt-3">
            <div className="flex justify-between items-center mb-0.5">
              <span className="font-medium text-secondary">Aspect Ratio</span>
              <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded font-mono font-medium animate-fade-in">
                {puterRatio}
              </span>
            </div>
            <Select value={puterRatio} onValueChange={handleRatioChange}>
              <SelectTrigger className="w-full h-8 text-[11px] bg-slate-950/60 border-accent/20">
                <SelectValue placeholder="Select Aspect Ratio" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="1:1">
                    <span className="font-medium text-foreground">1:1</span>
                    <span className="text-[10px] text-muted-foreground ml-2">(Square)</span>
                  </SelectItem>
                  <SelectItem value="16:9">
                    <span className="font-medium text-foreground">16:9</span>
                    <span className="text-[10px] text-muted-foreground ml-2">(Landscape)</span>
                  </SelectItem>
                  <SelectItem value="9:16">
                    <span className="font-medium text-foreground">9:16</span>
                    <span className="text-[10px] text-muted-foreground ml-2">(Portrait)</span>
                  </SelectItem>
                  <SelectItem value="3:2">
                    <span className="font-medium text-foreground">3:2</span>
                    <span className="text-[10px] text-muted-foreground ml-2">(Classic Photo)</span>
                  </SelectItem>
                  <SelectItem value="2:3">
                    <span className="font-medium text-foreground">2:3</span>
                    <span className="text-[10px] text-muted-foreground ml-2">(Comic / Book)</span>
                  </SelectItem>
                  <SelectItem value="21:9">
                    <span className="font-medium text-foreground">21:9</span>
                    <span className="text-[10px] text-muted-foreground ml-2">(Cinematic)</span>
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground leading-normal mt-0.5">
              Choose the layout shape for generated images. Supported by the Puter.js gpt-image-2 model.
            </p>
          </div>
        </div>
      )}

      {/* Google Sheet URL */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sheetUrl">Google Sheet URL</Label>
        <Input
          type="text"
          id="sheetUrl"
          value={sheetUrl}
          onChange={(e) => setSheetUrl(e.target.value)}
          disabled={isRunning}
          placeholder="https://docs.google.com/spreadsheets/d/..."
          spellCheck="false"
          autoComplete="off"
        />
      </div>

      {/* Tab + Column + Delay row */}
      <div className="flex gap-3">
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <Label htmlFor="tabName">Tab Name</Label>
          <Input
            type="text"
            id="tabName"
            value={tabName}
            onChange={(e) => setTabName(e.target.value)}
            disabled={isRunning}
            spellCheck="false"
            autoComplete="off"
          />
        </div>
        <div className="flex flex-col gap-1.5 flex-[0_0_60px] min-w-0">
          <Label htmlFor="columnLetter">Column</Label>
          <Input
            type="text"
            id="columnLetter"
            value={columnLetter}
            onChange={(e) => setColumnLetter(e.target.value.toUpperCase())}
            disabled={isRunning}
            placeholder="B"
            maxLength={3}
            spellCheck="false"
            autoComplete="off"
            style={{ textTransform: "uppercase" }}
          />
        </div>
        <div className="flex flex-col gap-1.5 flex-[0_0_85px] min-w-0">
          <Label htmlFor="delaySeconds">Delay (s)</Label>
          <NumberInput
            id="delaySeconds"
            value={delaySeconds}
            onChange={(e) => setDelaySeconds(e.target.value)}
            disabled={isRunning}
            min={0}
            max={120}
            step={1}
          />
        </div>
      </div>

      {/* Load button */}
      <Button
        id="loadBtn"
        variant="outline"
        onClick={handleLoadPrompts}
        disabled={isLoading || isRunning}
        className="w-full"
      >
        {isLoading ? "Loading…" : "Load Prompts"}
      </Button>

      {/* Prompt count */}
      {promptCountText && (
        <div
          id="promptCount"
          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/6 border border-emerald-500/15 rounded-md text-emerald-400 text-xs font-medium before:content-['✓'] before:font-bold animate-fade-in"
          aria-live="polite"
        >
          {promptCountText}
        </div>
      )}

      {/* Divider */}
      <hr className="border-none border-t border-border my-0.5" aria-hidden="true" />

      {/* Saved progress status text */}
      {!isRunning && savedProgress && (
        <div
          id="savedProgressStatus"
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-500/6 border border-blue-500/15 rounded-md text-blue-400 text-xs font-medium before:content-['✓'] before:font-bold animate-fade-in mb-1"
          aria-live="polite"
        >
          Found saved progress: Resume from prompt {savedProgress.currentIndex + 1} of {savedProgress.promptsCount}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2.5">
        {!isRunning ? (
          savedProgress ? (
            <>
              <Button
                id="startFreshBtn"
                variant="outline"
                onClick={() => handleStart(0)}
                disabled={loadedPrompts.length === 0 || (selectedTarget === "puter" && !isPuterSignedIn)}
                className="flex-1"
              >
                Start Fresh
              </Button>
              <Button
                id="resumeBtn"
                onClick={() => handleStart(savedProgress.currentIndex)}
                disabled={loadedPrompts.length === 0 || (selectedTarget === "puter" && !isPuterSignedIn)}
                className="flex-1"
              >
                Resume
              </Button>
            </>
          ) : (
            <Button
              id="startBtn"
              onClick={() => handleStart(0)}
              disabled={loadedPrompts.length === 0 || (selectedTarget === "puter" && !isPuterSignedIn)}
              className="flex-1"
            >
              Start
            </Button>
          )
        ) : (
          <Button
            id="stopBtn"
            variant="destructive"
            onClick={handleStop}
            className="flex-1"
          >
            Stop
          </Button>
        )}
      </div>

      {/* Progress */}
      {loadedPrompts.length > 0 && (
        <div id="progressSection" className="flex flex-col gap-2 py-1 animate-fade-in" aria-live="polite">
          <Progress value={progressPercent} />
          <p id="progressText" className="text-[11px] font-medium text-secondary text-center">
            {progressText}
          </p>
        </div>
      )}

      {/* Status */}
      {status && (
        <div
          id="statusArea"
          className={`px-3 py-2.5 rounded-md text-xs leading-relaxed break-all animate-fade-in ${
            status.type === "error"
              ? "bg-red-500/8 border border-red-500/20 text-red-300"
              : status.type === "success"
              ? "bg-emerald-500/8 border border-emerald-500/20 text-emerald-300"
              : "bg-blue-500/8 border border-blue-500/20 text-blue-300"
          }`}
          role="status"
          aria-live="polite"
        >
          {status.text}
        </div>
      )}

      {/* Session Gallery Previews */}
      {sessionImages.length > 0 && (
        <div className="gallery-container animate-fade-in">
          <Label className="text-[11px] uppercase tracking-wider text-secondary">Generated Images ({sessionImages.length})</Label>
          <div className="gallery-grid">
            {sessionImages.map((imgUrl, idx) => (
              <div key={idx} className="gallery-item">
                <img
                  src={imgUrl}
                  alt={`Generated Preview ${idx + 1}`}
                  className="gallery-img"
                  onClick={() => {
                    // Open image in a new tab when clicked
                    const w = window.open();
                    w.document.write(`<img src="${imgUrl}" style="max-width:100%; height:auto;" />`);
                  }}
                  title="Click to view full size"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
