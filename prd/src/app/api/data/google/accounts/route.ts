import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import {
  cleanEnvValue,
  getGoogleAdsConfig,
  normalizeGoogleAdsCustomerId,
  readGoogleAdsJson,
  type GoogleAdsConfig,
} from "@/lib/integrations/google-ads";
import { getProviderAccessToken } from "@/lib/integrations/tokens";
import { reportLogger } from "@/lib/report/logger";

const prisma = new PrismaClient();

interface PropertySummary {
  property?: string;
  displayName?: string;
}

interface AccountSummary {
  propertySummaries?: PropertySummary[];
}

interface GoogleAdsAccount {
  id: string;
  name: string;
}

interface GoogleAdsCustomerClientRow {
  customerClient?: {
    clientCustomer?: string;
    id?: string | number;
    descriptiveName?: string;
    manager?: boolean;
    status?: string;
  };
}

interface GoogleAdsCustomerRow {
  customer?: {
    id?: string | number;
    descriptiveName?: string;
    manager?: boolean;
    status?: string;
  };
}

function getCustomerClientId(client: GoogleAdsCustomerClientRow["customerClient"]) {
  const raw = client?.clientCustomer ?? client?.id ?? "";
  return String(raw).replace(/^customers\//, "").replace(/\D/g, "");
}

function getCustomerId(customer: GoogleAdsCustomerRow["customer"]) {
  return String(customer?.id ?? "").replace(/\D/g, "");
}

function isCustomerNotEnabledError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /CUSTOMER_NOT_ENABLED|not yet enabled|deactivated/i.test(message);
}

function addGoogleAdsAccount(accounts: Map<string, GoogleAdsAccount>, id: string, name?: string) {
  if (!id) return;

  const fallbackName = `Customer ${id}`;
  const current = accounts.get(id);
  if (!current || (current.name === fallbackName && name)) {
    accounts.set(id, { id, name: name || fallbackName });
  }
}

async function fetchGoogleAdsCustomerClients(
  config: GoogleAdsConfig,
  accessToken: string,
  customerId: string,
  loginCustomerId: string
) {
  const response = await fetch(`https://googleads.googleapis.com/${config.apiVersion}/customers/${customerId}/googleAds:searchStream`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "developer-token": config.developerToken,
      "login-customer-id": loginCustomerId,
    },
    body: JSON.stringify({
      query: `
        SELECT
          customer_client.client_customer,
          customer_client.id,
          customer_client.descriptive_name,
          customer_client.manager,
          customer_client.status,
          customer_client.level
        FROM customer_client
        WHERE customer_client.level <= 1
      `,
    }),
  });
  const data = await readGoogleAdsJson(response);

  const chunks = Array.isArray(data) ? data : [data];
  return chunks.flatMap((chunk) => chunk.results ?? []) as GoogleAdsCustomerClientRow[];
}

async function fetchAccessibleGoogleAdsCustomers(config: GoogleAdsConfig, accessToken: string) {
  const response = await fetch(`https://googleads.googleapis.com/${config.apiVersion}/customers:listAccessibleCustomers`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "developer-token": config.developerToken,
    },
  });
  const data = await readGoogleAdsJson(response);
  return (data.resourceNames ?? [])
    .map((resourceName: string) => normalizeGoogleAdsCustomerId(resourceName))
    .filter(Boolean) as string[];
}

async function fetchGoogleAdsCustomer(
  config: GoogleAdsConfig,
  accessToken: string,
  customerId: string,
  loginCustomerId?: string
) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "developer-token": config.developerToken,
  };
  if (loginCustomerId) {
    headers["login-customer-id"] = loginCustomerId;
  }

  const response = await fetch(`https://googleads.googleapis.com/${config.apiVersion}/customers/${customerId}/googleAds:searchStream`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      query: `
        SELECT
          customer.id,
          customer.descriptive_name,
          customer.manager,
          customer.status
        FROM customer
      `,
    }),
  });
  const data = await readGoogleAdsJson(response);
  const chunks = Array.isArray(data) ? data : [data];
  return chunks.flatMap((chunk) => chunk.results ?? [])[0] as GoogleAdsCustomerRow | undefined;
}

async function addDirectAccessibleGoogleAdsAccounts(
  config: GoogleAdsConfig,
  accessToken: string,
  customerIds: string[],
  excludedCustomerId: string | undefined,
  accounts: Map<string, GoogleAdsAccount>,
  diagnostics: string[]
) {
  for (const customerId of customerIds) {
    if (customerId === excludedCustomerId) continue;

    try {
      const row = await fetchGoogleAdsCustomer(config, accessToken, customerId);
      const customer = row?.customer;
      const id = getCustomerId(customer) || customerId;

      if (customer?.status && customer.status !== "ENABLED") {
        diagnostics.push(`Direct accessible customer ${customerId} skipped because status is ${customer.status}.`);
        continue;
      }

      if (customer?.manager) {
        const managersSearched = await addGoogleAdsHierarchyAccounts(config, accessToken, id, id, accounts);
        diagnostics.push(`Direct accessible manager hierarchy query succeeded for ${id}. Managers searched: ${managersSearched}. Accounts found so far: ${accounts.size}`);
      } else {
        addGoogleAdsAccount(accounts, id, customer?.descriptiveName);
      }
    } catch (error: any) {
      const message = error.message || "Неизвестна грешка.";
      if (isCustomerNotEnabledError(error)) {
        diagnostics.push(`Direct accessible customer ${customerId} skipped because it is not enabled: ${message}`);
      } else {
        diagnostics.push(`Direct accessible customer ${customerId} skipped because details could not be loaded: ${message}`);
      }
    }
  }
}

async function addGoogleAdsHierarchyAccounts(
  config: GoogleAdsConfig,
  accessToken: string,
  rootCustomerId: string,
  loginCustomerId: string,
  accounts: Map<string, GoogleAdsAccount>
) {
  const managerQueue = [rootCustomerId];
  const searchedManagers = new Set<string>();

  while (managerQueue.length > 0) {
    const customerId = managerQueue.shift()!;
    if (searchedManagers.has(customerId)) continue;
    searchedManagers.add(customerId);

    const rows = await fetchGoogleAdsCustomerClients(config, accessToken, customerId, loginCustomerId);
    for (const row of rows) {
      const client = row.customerClient;
      if (client?.status && client.status !== "ENABLED") continue;

      const id = getCustomerClientId(client);
      if (!id) continue;

      const isSelf = id === customerId;
      if (isSelf) {
        if (!client?.manager) {
          addGoogleAdsAccount(accounts, id, client?.descriptiveName);
        }
        continue;
      }

      if (client?.manager) {
        managerQueue.push(id);
      } else {
        addGoogleAdsAccount(accounts, id, client?.descriptiveName);
      }
    }
  }

  return searchedManagers.size;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Сесията е изтекла. Влезте отново." }, { status: 401 });
  }

  try {
    const userId = (session.user as any).id as string;
    const accessToken = await getProviderAccessToken(prisma, userId, "google");
    const headers = { Authorization: `Bearer ${accessToken}` };
    const warnings: string[] = [];
    const googleAdsDiagnostics: string[] = [];
    const properties = new Map<string, { id: string; name: string; websiteUrl: null }>();
    const googleAdsAccounts: Array<{ id: string; name: string }> = [];
    let pageToken = "";

    do {
      const params = new URLSearchParams({ pageSize: "200" });
      if (pageToken) params.set("pageToken", pageToken);

      const ga4Res = await fetch(
        `https://analyticsadmin.googleapis.com/v1beta/accountSummaries?${params.toString()}`,
        { headers }
      );
      const ga4Data = await ga4Res.json();

      if (!ga4Res.ok) {
        reportLogger.warn("Google Analytics Admin accounts fetch failed");
        warnings.push("Не можахме да заредим GA4 пропъртитата. Проверете дали Google Analytics Admin API е активиран и дали акаунтът има достъп.");
        break;
      }

      for (const account of (ga4Data.accountSummaries ?? []) as AccountSummary[]) {
        for (const property of account.propertySummaries ?? []) {
          if (property.property) {
            properties.set(property.property, {
              id: property.property,
              name: property.displayName ?? property.property,
              websiteUrl: null,
            });
          }
        }
      }

      pageToken = ga4Data.nextPageToken ?? "";
    } while (pageToken);

    const gscRes = await fetch("https://www.googleapis.com/webmasters/v3/sites", { headers });
    const gscData = await gscRes.json();
    if (!gscRes.ok) {
      reportLogger.warn("Google Search Console sites fetch failed");
      warnings.push("Не можахме да заредим Search Console сайтовете. Проверете дали Search Console API е активиран и дали акаунтът има достъп.");
    }

    const googleAdsDeveloperToken = cleanEnvValue(process.env.GOOGLE_ADS_DEVELOPER_TOKEN);
    if (googleAdsDeveloperToken) {
      const googleAdsAccountsById = new Map<string, GoogleAdsAccount>();
      const config = getGoogleAdsConfig();
      let accessibleCustomerIds: string[] = [];
      let listAccessibleSucceeded = false;
      let managerHierarchySucceeded = false;
      let managerHierarchyError = "";

      googleAdsDiagnostics.push(`Google Ads API version: ${config.apiVersion}`);
      googleAdsDiagnostics.push(`Developer token configured: yes`);
      googleAdsDiagnostics.push(`Login customer ID: ${config.loginCustomerId || "not configured"}`);

      try {
        accessibleCustomerIds = await fetchAccessibleGoogleAdsCustomers(config, accessToken);
        listAccessibleSucceeded = true;
        googleAdsDiagnostics.push(`listAccessibleCustomers succeeded. Directly accessible customers found: ${accessibleCustomerIds.length}`);
      } catch (error: any) {
        reportLogger.warn("Google Ads customers fetch failed");
        const message = error.message || "Неизвестна грешка.";
        googleAdsDiagnostics.push(`listAccessibleCustomers failed: ${message}`);
      }

      if (config.loginCustomerId) {
        try {
          const managersSearched = await addGoogleAdsHierarchyAccounts(
            config,
            accessToken,
            config.loginCustomerId,
            config.loginCustomerId,
            googleAdsAccountsById
          );
          managerHierarchySucceeded = true;
          googleAdsDiagnostics.push(
            `MCC hierarchy query succeeded. Managers searched: ${managersSearched}. Client accounts found: ${googleAdsAccountsById.size}`
          );
        } catch (error: any) {
          reportLogger.warn("Google Ads customer clients fetch failed");
          const message = error.message || "Неизвестна грешка.";
          managerHierarchyError = message;
          googleAdsDiagnostics.push(`MCC hierarchy query failed: ${message}`);
        }
      } else if (accessibleCustomerIds.length > 0) {
        for (const customerId of accessibleCustomerIds) {
          try {
            const managersSearched = await addGoogleAdsHierarchyAccounts(
              config,
              accessToken,
              customerId,
              customerId,
              googleAdsAccountsById
            );
            googleAdsDiagnostics.push(
              `Accessible customer hierarchy query succeeded for ${customerId}. Managers searched: ${managersSearched}. Accounts found so far: ${googleAdsAccountsById.size}`
            );
          } catch (error: any) {
            const message = error.message || "Неизвестна грешка.";
            googleAdsDiagnostics.push(`Accessible customer hierarchy query failed for ${customerId}: ${message}`);
          }
        }
      }

      if (googleAdsAccountsById.size === 0 && listAccessibleSucceeded) {
        await addDirectAccessibleGoogleAdsAccounts(
          config,
          accessToken,
          accessibleCustomerIds,
          config.loginCustomerId,
          googleAdsAccountsById,
          googleAdsDiagnostics
        );
        googleAdsDiagnostics.push(`Validated direct accessible fallback applied. Accounts found: ${googleAdsAccountsById.size}`);
      }

      googleAdsAccounts.push(...Array.from(googleAdsAccountsById.values()).sort((a, b) => a.name.localeCompare(b.name)));

      if (googleAdsAccounts.length === 0) {
        if (!listAccessibleSucceeded) {
          warnings.push("Не можахме да заредим Google Ads акаунтите. Проверете Developer Token, adwords OAuth scope и достъпа до Ads акаунта.");
        } else if (config.loginCustomerId && managerHierarchyError) {
          warnings.push(`Не можахме да заредим Google Ads клиентските акаунти през MCC ${config.loginCustomerId}. ${managerHierarchyError}`);
        } else if (config.loginCustomerId && managerHierarchySucceeded) {
          warnings.push("Google Ads Manager акаунтът е достъпен, но не върна активни клиентски акаунти.");
        } else {
          warnings.push("Google Ads API е достъпен, но не върна акаунти за този Google потребител.");
        }
      }
    } else {
      warnings.push("Google Ads акаунтите не са заредени, защото липсва GOOGLE_ADS_DEVELOPER_TOKEN.");
      googleAdsDiagnostics.push("Developer token configured: no");
    }

    return NextResponse.json({
      ga4Properties: Array.from(properties.values()),
      gscSites: (gscRes.ok ? (gscData.siteEntry ?? []) : []).map((site: any) => ({
        siteUrl: site.siteUrl,
        permissionLevel: site.permissionLevel,
      })),
      googleAdsAccounts,
      warnings,
      googleAdsDiagnostics,
    });
  } catch (error: any) {
    reportLogger.warn("Google accounts fetch failed");
    const status = error.message?.includes("връзката") || error.message?.includes("интеграция") ? 401 : 500;
    return NextResponse.json({ error: error.message || "Google акаунтите не могат да бъдат заредени в момента." }, { status });
  }
}
