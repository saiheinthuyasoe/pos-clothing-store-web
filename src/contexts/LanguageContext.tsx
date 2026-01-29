"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getTranslation } from "../lib/translations";

type LangCtx = {
  lang: string;
  setLanguage: (code: string) => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<LangCtx | null>(null);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [lang, setLang] = useState<string>("EN");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("lang");
      if (saved) setLang(saved);
      if (typeof document !== "undefined") {
        document.documentElement.lang = saved === "MM" ? "my" : "en";
      }
    } catch (e) {
      // ignore
    }

    const onAppLang = (ev: Event) => {
      try {
        // @ts-ignore
        const code = ev?.detail ?? null;
        if (code) setLang(code);
      } catch (e) {
        // ignore
      }
    };

    window.addEventListener("app:language", onAppLang as EventListener);
    return () =>
      window.removeEventListener("app:language", onAppLang as EventListener);
  }, []);

  const setLanguage = (code: string) => {
    setLang(code);
    try {
      localStorage.setItem("lang", code);
      if (typeof document !== "undefined") {
        document.documentElement.lang = code === "MM" ? "my" : "en";
      }
      try {
        window.dispatchEvent(new CustomEvent("app:language", { detail: code }));
      } catch (e) {
        // ignore
      }
    } catch (e) {
      // ignore
    }
  };

  const t = (key: string) => getTranslation(lang, key);

  const value = useMemo(() => ({ lang, setLanguage, t }), [lang]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
};
