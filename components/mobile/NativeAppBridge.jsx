"use client";

import { useEffect } from "react";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { getMobileAppDestination } from "../../core/mobile-link.js";
import { parseNativeAuthCallback } from "../../core/native-auth.js";
import { createClient } from "../../lib/supabase/client.js";

export default function NativeAppBridge() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;

    let disposed = false;
    let listenerHandle;
    let photoPickerOpen = false;

    document.documentElement.dataset.nativeApp = "true";

    const keepInsideWorkspace = () => {
      if (window.location.pathname === "/") {
        window.location.replace(`/create${window.location.search}${window.location.hash}`);
      }
    };

    const pickPhoto = async () => {
      if (photoPickerOpen) return;

      const input = document.querySelector("#imageInput");
      if (!(input instanceof HTMLInputElement) || input.disabled) return;

      photoPickerOpen = true;
      try {
        const photo = await Camera.getPhoto({
          source: CameraSource.Photos,
          resultType: CameraResultType.Uri,
          quality: 100,
          correctOrientation: true,
          allowEditing: false,
        });
        if (!photo.webPath) throw new Error("Native photo picker did not return an image");

        const response = await fetch(photo.webPath);
        if (!response.ok) throw new Error("Selected photo could not be read");

        const blob = await response.blob();
        const extension = photo.format || blob.type.split("/")[1] || "jpeg";
        const file = new File([blob], `string-art-photo.${extension}`, {
          type: blob.type || `image/${extension}`,
          lastModified: Date.now(),
        });
        const transfer = new DataTransfer();
        transfer.items.add(file);
        input.files = transfer.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      } catch (error) {
        const message = error instanceof Error ? error.message.toLowerCase() : "";
        const cancelled = message.includes("cancel") || message.includes("canceled");
        if (!cancelled && !disposed) input.click();
      } finally {
        photoPickerOpen = false;
      }
    };

    const handleDocumentClick = (event) => {
      const photoUpload = event.target instanceof Element
        ? event.target.closest(".photo-upload")
        : null;
      if (photoUpload) {
        event.preventDefault();
        void pickPhoto();
        return;
      }

      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!anchor) return;

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin || destination.pathname !== "/") return;

      event.preventDefault();
      window.location.assign(`/create${destination.search}${destination.hash}`);
    };

    const openAppUrl = async ({ url }) => {
      const authCallback = parseNativeAuthCallback(url);
      if (authCallback) {
        try {
          await Browser.close();
        } catch {
          // Android closes the custom tab automatically when the app regains focus.
        }

        if (authCallback.error) {
          window.location.assign("/login?confirmation=failed");
          return;
        }

        const supabase = createClient();
        const result = authCallback.code
          ? await supabase.auth.exchangeCodeForSession(authCallback.code)
          : authCallback.accessToken && authCallback.refreshToken
            ? await supabase.auth.setSession({
                access_token: authCallback.accessToken,
                refresh_token: authCallback.refreshToken,
              })
            : { error: new Error("Authentication callback has no session code") };

        window.location.assign(result.error ? "/login?confirmation=failed" : "/projects");
        return;
      }

      const destination = getMobileAppDestination(url);
      if (!destination) return;

      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (destination !== current) window.location.assign(destination);
    };

    void App.addListener("appUrlOpen", (event) => {
      void openAppUrl(event);
    }).then((handle) => {
      if (disposed) {
        void handle.remove();
        return;
      }
      listenerHandle = handle;
    });

    void App.getLaunchUrl().then((launch) => {
      if (!disposed && launch?.url) void openAppUrl(launch);
    });

    keepInsideWorkspace();
    document.addEventListener("click", handleDocumentClick, true);
    window.addEventListener("popstate", keepInsideWorkspace);

    return () => {
      disposed = true;
      delete document.documentElement.dataset.nativeApp;
      document.removeEventListener("click", handleDocumentClick, true);
      window.removeEventListener("popstate", keepInsideWorkspace);
      void listenerHandle?.remove();
    };
  }, []);

  return null;
}
