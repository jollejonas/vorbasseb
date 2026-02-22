"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "cookie-consent";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  function accept() {
    localStorage.setItem(STORAGE_KEY, "true");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 sm:left-auto sm:right-6 sm:max-w-sm">
      <div className="bg-secondary text-white rounded-2xl p-5 shadow-xl flex flex-col gap-3">
        <p className="text-sm leading-relaxed">
          Vi bruger cookies til at forbedre din oplevelse på VBK Shoppen.{" "}
          <a href="/privatlivspolitik" className="text-primary underline hover:text-primary-dark">
            Læs mere
          </a>
        </p>
        <button
          onClick={accept}
          className="self-start bg-primary text-secondary font-bold px-5 py-2 rounded-xl text-sm hover:bg-primary-dark transition"
        >
          Acceptér
        </button>
      </div>
    </div>
  );
}
