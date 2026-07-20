const GOOGLE_IDENTITY_SCRIPT = "https://accounts.google.com/gsi/client";
const GOOGLE_PICKER_SCRIPT = "https://apis.google.com/js/api.js";
const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";

interface TokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  requestAccessToken(config?: { prompt?: string }): void;
}

interface PickerDocument {
  id: string;
  name: string;
  mimeType: string;
}

interface PickerView {
  setMimeTypes(mimeTypes: string): PickerView;
  setSelectFolderEnabled(enabled: boolean): PickerView;
}

interface PickerInstance {
  setVisible(visible: boolean): void;
}

interface PickerBuilder {
  addView(view: PickerView): PickerBuilder;
  setOAuthToken(token: string): PickerBuilder;
  setDeveloperKey(key: string): PickerBuilder;
  setAppId(appId: string): PickerBuilder;
  setTitle(title: string): PickerBuilder;
  setCallback(callback: (data: Record<string, unknown>) => void): PickerBuilder;
  enableFeature(feature: string): PickerBuilder;
  build(): PickerInstance;
}

interface GoogleSdk {
  accounts: {
    oauth2: {
      initTokenClient(config: {
        client_id: string;
        scope: string;
        callback: (response: TokenResponse) => void;
        error_callback?: (error: { type?: string }) => void;
      }): TokenClient;
    };
  };
  picker: {
    DocsView: new (viewId: string) => PickerView;
    PickerBuilder: new () => PickerBuilder;
    ViewId: { DOCS: string };
    Action: { PICKED: string; CANCEL: string };
    Response: { ACTION: string; DOCUMENTS: string };
    Document: { ID: string; NAME: string; MIME_TYPE: string };
    Feature: { SUPPORT_DRIVES: string };
  };
}

interface GapiSdk {
  load(
    library: string,
    options: {
      callback: () => void;
      onerror: () => void;
      timeout: number;
      ontimeout: () => void;
    },
  ): void;
}

type GoogleWindow = Window & {
  google?: GoogleSdk;
  gapi?: GapiSdk;
};

export interface DriveDownloadProgress {
  loaded: number;
  total: number | null;
  percent: number | null;
}

let sdkPromise: Promise<void> | null = null;

function loadScript(id: string, source: string): Promise<void> {
  const existing = document.getElementById(id) as HTMLScriptElement | null;
  if (existing?.dataset.loaded === "true") return Promise.resolve();

  return new Promise((resolve, reject) => {
    const script = existing ?? document.createElement("script");
    const handleLoad = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    const handleError = () => reject(new Error("Google Drive SDK gagal dimuat."));
    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });
    if (!existing) {
      script.id = id;
      script.src = source;
      script.async = true;
      document.head.appendChild(script);
    }
  });
}

function ensureGoogleSdk(): Promise<void> {
  if (sdkPromise) return sdkPromise;
  sdkPromise = Promise.all([
    loadScript("google-identity-services", GOOGLE_IDENTITY_SCRIPT),
    loadScript("google-picker-api", GOOGLE_PICKER_SCRIPT),
  ]).then(
    () =>
      new Promise<void>((resolve, reject) => {
        const gapi = (window as GoogleWindow).gapi;
        if (!gapi) {
          reject(new Error("Google Picker API tidak tersedia."));
          return;
        }
        gapi.load("picker", {
          callback: resolve,
          onerror: () => reject(new Error("Google Picker gagal dimuat.")),
          timeout: 10_000,
          ontimeout: () => reject(new Error("Google Picker terlalu lama merespons.")),
        });
      }),
  );
  return sdkPromise;
}

function requestAccessToken(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const google = (window as GoogleWindow).google;
    if (!google) {
      reject(new Error("Google Identity Services tidak tersedia."));
      return;
    }

    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_FILE_SCOPE,
      callback: (response) => {
        if (response.access_token) resolve(response.access_token);
        else reject(new Error(response.error_description ?? response.error ?? "Akses Google Drive tidak diberikan."));
      },
      error_callback: () => reject(new Error("Login Google Drive dibatalkan atau gagal.")),
    });
    client.requestAccessToken({ prompt: "" });
  });
}

function openPicker(accessToken: string, apiKey: string, appId: string): Promise<PickerDocument | null> {
  return new Promise((resolve) => {
    const google = (window as GoogleWindow).google;
    if (!google?.picker) {
      resolve(null);
      return;
    }

    const picker = google.picker;
    const view = new picker.DocsView(picker.ViewId.DOCS)
      .setMimeTypes("text/csv,application/vnd.ms-excel,text/plain")
      .setSelectFolderEnabled(false);

    const pickerInstance = new picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(accessToken)
      .setDeveloperKey(apiKey)
      .setAppId(appId)
      .setTitle("Pilih file CSV")
      .enableFeature(picker.Feature.SUPPORT_DRIVES)
      .setCallback((data) => {
        const action = data[picker.Response.ACTION];
        if (action === picker.Action.CANCEL) {
          resolve(null);
          return;
        }
        if (action !== picker.Action.PICKED) return;

        const documents = data[picker.Response.DOCUMENTS] as Array<Record<string, unknown>> | undefined;
        const selected = documents?.[0];
        if (!selected) {
          resolve(null);
          return;
        }
        resolve({
          id: String(selected[picker.Document.ID] ?? ""),
          name: String(selected[picker.Document.NAME] ?? "drive-file.csv"),
          mimeType: String(selected[picker.Document.MIME_TYPE] ?? "text/csv"),
        });
      })
      .build();
    pickerInstance.setVisible(true);
  });
}

async function downloadDriveFile(
  document: PickerDocument,
  accessToken: string,
  onProgress?: (progress: DriveDownloadProgress) => void,
): Promise<File> {
  if (!document.name.toLowerCase().endsWith(".csv")) {
    throw new Error("Pilih file dengan ekstensi .csv dari Google Drive.");
  }

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(document.id)}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!response.ok) {
    throw new Error(`File Google Drive gagal diunduh (${response.status}).`);
  }

  const totalHeader = Number(response.headers.get("content-length") ?? 0);
  const total = totalHeader > 0 ? totalHeader : null;
  if (!response.body) {
    const blob = await response.blob();
    return new File([blob], document.name, { type: document.mimeType || "text/csv" });
  }

  const reader = response.body.getReader();
  const chunks: BlobPart[] = [];
  let loaded = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value.slice().buffer as ArrayBuffer);
    loaded += value.byteLength;
    onProgress?.({
      loaded,
      total,
      percent: total ? Math.min(100, Math.round((loaded / total) * 100)) : null,
    });
  }

  return new File(chunks, document.name, { type: document.mimeType || "text/csv" });
}

export async function pickCsvFromGoogleDrive(
  onProgress?: (progress: DriveDownloadProgress) => void,
): Promise<File | null> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
  const appId = process.env.NEXT_PUBLIC_GOOGLE_APP_ID;
  if (!clientId || !apiKey || !appId) {
    throw new Error("Google Drive belum dikonfigurasi. Isi NEXT_PUBLIC_GOOGLE_CLIENT_ID, NEXT_PUBLIC_GOOGLE_API_KEY, dan NEXT_PUBLIC_GOOGLE_APP_ID pada .env.local.");
  }

  await ensureGoogleSdk();
  const accessToken = await requestAccessToken(clientId);
  const selected = await openPicker(accessToken, apiKey, appId);
  if (!selected) return null;
  return downloadDriveFile(selected, accessToken, onProgress);
}
