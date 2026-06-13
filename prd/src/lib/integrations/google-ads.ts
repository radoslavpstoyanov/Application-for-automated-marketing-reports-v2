export interface GoogleAdsConfig {
  apiVersion: string;
  developerToken: string;
  loginCustomerId?: string;
}

export function cleanEnvValue(value: string | undefined) {
  return value?.trim();
}

export function normalizeGoogleAdsCustomerId(value: string, errorMessage = "Невалиден Google Ads Customer ID.") {
  const normalized = value.replace(/^customers\//, "").replace(/\D/g, "");
  if (!normalized) {
    throw new Error(errorMessage);
  }
  return normalized;
}

function textSnippet(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 800);
}

export async function readResponseBody(response: Response) {
  const text = await response.text();
  try {
    return { data: text ? JSON.parse(text) : null, text };
  } catch {
    return { data: null, text };
  }
}

function uniqueMessages(messages: string[]) {
  return Array.from(new Set(messages.map((message) => message.trim()).filter(Boolean)));
}

export function googleAdsErrorMessage(data: any, rawText = "") {
  const messages: string[] = [];
  const error = data?.error;

  if (typeof error?.message === "string" && error.message.trim()) {
    messages.push(error.message);
  }

  for (const detail of error?.details ?? []) {
    for (const adsError of detail?.errors ?? []) {
      if (typeof adsError?.message === "string" && adsError.message.trim()) {
        messages.push(adsError.message);
      }

      const errorCode = adsError?.errorCode;
      if (errorCode && typeof errorCode === "object") {
        const code = Object.entries(errorCode)
          .map(([group, value]) => `${group}: ${value}`)
          .join(", ");
        if (code) messages.push(code);
      }
    }

    if (typeof detail?.requestId === "string" && detail.requestId.trim()) {
      messages.push(`Google request ID: ${detail.requestId}`);
    }
  }

  if (typeof error?.status === "string" && error.status.trim()) {
    messages.push(`Status: ${error.status}`);
  }

  const rawSnippet = textSnippet(rawText);
  if (!messages.length && rawSnippet) {
    messages.push(`Raw response: ${rawSnippet}`);
  }

  return uniqueMessages(messages).join(" ");
}

export function googleAdsHttpError(response: Response, data: any, rawText: string) {
  const parsed = googleAdsErrorMessage(data, rawText);
  return `[HTTP ${response.status} ${response.statusText}] ${parsed || "Google Ads API върна грешка без JSON body."}`;
}

export async function readGoogleAdsJson(response: Response) {
  const { data, text } = await readResponseBody(response);
  if (!response.ok) {
    throw new Error(googleAdsHttpError(response, data, text));
  }
  return data;
}

export function getGoogleAdsConfig() {
  const developerToken = cleanEnvValue(process.env.GOOGLE_ADS_DEVELOPER_TOKEN);
  if (!developerToken) {
    throw new Error("Липсва GOOGLE_ADS_DEVELOPER_TOKEN. Добавете Google Ads Developer Token в .env.local и рестартирайте dev server-а.");
  }

  const loginCustomerId = cleanEnvValue(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID);

  return {
    apiVersion: cleanEnvValue(process.env.GOOGLE_ADS_API_VERSION) || "v22",
    developerToken,
    loginCustomerId: loginCustomerId ? normalizeGoogleAdsCustomerId(loginCustomerId) : undefined,
  } satisfies GoogleAdsConfig;
}
