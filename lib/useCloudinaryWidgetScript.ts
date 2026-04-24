"use client";

import { useEffect, useState } from "react";

const CLOUDINARY_WIDGET_SRC = "https://upload-widget.cloudinary.com/global/all.js";

let loadCloudinaryWidgetPromise: Promise<void> | null = null;

function loadCloudinaryWidgetScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();

  // @ts-expect-error cloudinary global
  if (window.cloudinary?.createUploadWidget) {
    return Promise.resolve();
  }

  if (!loadCloudinaryWidgetPromise) {
    loadCloudinaryWidgetPromise = new Promise<void>((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${CLOUDINARY_WIDGET_SRC}"]`);
      const script = existingScript ?? document.createElement("script");

      const cleanup = () => {
        script.removeEventListener("load", handleLoad);
        script.removeEventListener("error", handleError);
      };

      const handleLoad = () => {
        cleanup();
        // @ts-expect-error cloudinary global
        if (window.cloudinary?.createUploadWidget) {
          resolve();
          return;
        }
        loadCloudinaryWidgetPromise = null;
        reject(new Error("Cloudinary widget is unavailable after script load"));
      };

      const handleError = () => {
        cleanup();
        loadCloudinaryWidgetPromise = null;
        reject(new Error("Cloudinary widget script failed to load"));
      };

      script.addEventListener("load", handleLoad);
      script.addEventListener("error", handleError);

      if (!existingScript) {
        script.src = CLOUDINARY_WIDGET_SRC;
        script.async = true;
        document.head.appendChild(script);
      } else {
        // Existing script might already be loaded before listeners were attached.
        // @ts-expect-error cloudinary global
        if (window.cloudinary?.createUploadWidget) {
          cleanup();
          resolve();
        }
      }
    });
  }

  return loadCloudinaryWidgetPromise;
}

export function useCloudinaryWidgetScript() {
  const [scriptReady, setScriptReady] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadCloudinaryWidgetScript()
      .then(() => {
        if (!cancelled) {
          setScriptReady(true);
          setScriptError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setScriptReady(false);
          setScriptError("Cloudinary widget kunne ikke indlaeses. Tjek netvaerk/CSP og prov igen.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { scriptReady, scriptError };
}
