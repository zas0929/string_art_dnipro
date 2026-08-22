import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

export function isNativeFileShareAvailable() {
  return Capacitor.isNativePlatform();
}

export async function shareNativeFile({ blob, filename, title }) {
  if (!isNativeFileShareAvailable()) return false;

  const data = await blobToBase64(blob);
  const result = await Filesystem.writeFile({
    path: `exports/${filename}`,
    data,
    directory: Directory.Cache,
    recursive: true,
  });

  await Share.share({
    title,
    url: result.uri,
    dialogTitle: title,
  });

  return true;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("Could not read the exported file"));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Could not encode the exported file"));
        return;
      }
      resolve(reader.result.split(",", 2)[1] || "");
    };
    reader.readAsDataURL(blob);
  });
}
