import { prisma } from "@/lib/prisma";

export type FreepbxApiConfig = {
  enabled: boolean;
  baseUrl: string;
  tokenUrl: string;
  graphqlUrl: string;
  clientId: string;
  clientSecret: string;
  syncIntervalMin: number;
  matchMode: "contains" | "starts_with" | "strict";
};

export async function getFreepbxApiConfig(tenantId: string): Promise<FreepbxApiConfig> {
  const settings = await prisma.setting.findMany({
    where: {
      tenantId,
      key: {
        in: [
          "freepbx_directory_sync_enabled",
          "freepbx_api_base_url",
          "freepbx_api_token_url",
          "freepbx_api_graphql_url",
          "freepbx_api_client_id",
          "freepbx_api_client_secret",
          "freepbx_directory_sync_interval_min",
          "freepbx_directory_match_mode",
        ],
      },
    },
  });

  const map = new Map<string, string>(settings.map((setting) => [setting.key, setting.value] as [string, string]));

  return {
    enabled: map.get("freepbx_directory_sync_enabled") === "true",
    baseUrl: map.get("freepbx_api_base_url") ?? "",
    tokenUrl: map.get("freepbx_api_token_url") ?? "",
    graphqlUrl: map.get("freepbx_api_graphql_url") ?? "",
    clientId: map.get("freepbx_api_client_id") ?? "",
    clientSecret: map.get("freepbx_api_client_secret") ?? "",
    syncIntervalMin: Number(map.get("freepbx_directory_sync_interval_min") ?? "60"),
    matchMode: (map.get("freepbx_directory_match_mode") as FreepbxApiConfig["matchMode"] | undefined) ?? "contains",
  };
}

export function isFreepbxApiConfigured(config: FreepbxApiConfig) {
  return Boolean(
    config.enabled &&
      config.baseUrl.trim() &&
      config.tokenUrl.trim() &&
      config.graphqlUrl.trim() &&
      config.clientId.trim() &&
      config.clientSecret.trim(),
  );
}
