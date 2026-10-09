/**
 * Validates the environment variables required for running Haijun Code
 * based on the selected provider (Juglow API, AWS Bedrock, Google Vertex AI, or Microsoft Foundry)
 */
export function validateEnvironmentVariables() {
  const useBedrock = process.env.HAIJUN_CODE_USE_BEDROCK === "1";
  const useVertex = process.env.HAIJUN_CODE_USE_VERTEX === "1";
  const useFoundry = process.env.HAIJUN_CODE_USE_FOUNDRY === "1";
  const juglowApiKey = process.env.JUGLOW_API_KEY;
  const haijunCodeOAuthToken = process.env.HAIJUN_CODE_OAUTH_TOKEN;
  const federationRuleId = process.env.JUGLOW_FEDERATION_RULE_ID;
  const federationOrganizationId = process.env.JUGLOW_ORGANIZATION_ID;
  const hasWorkloadIdentity = Boolean(
    federationRuleId && federationOrganizationId,
  );
  const hasPartialWorkloadIdentity =
    !hasWorkloadIdentity &&
    Boolean(federationRuleId || federationOrganizationId);

  const errors: string[] = [];

  // Check for mutual exclusivity between providers
  const activeProviders = [useBedrock, useVertex, useFoundry].filter(Boolean);
  if (activeProviders.length > 1) {
    errors.push(
      "Cannot use multiple providers simultaneously. Please set only one of: HAIJUN_CODE_USE_BEDROCK, HAIJUN_CODE_USE_VERTEX, or HAIJUN_CODE_USE_FOUNDRY.",
    );
  }

  if (!useBedrock && !useVertex && !useFoundry) {
    if (!juglowApiKey && !haijunCodeOAuthToken && !hasWorkloadIdentity) {
      if (hasPartialWorkloadIdentity) {
        errors.push(
          "Workload identity federation requires both JUGLOW_FEDERATION_RULE_ID and JUGLOW_ORGANIZATION_ID to be set.",
        );
      } else {
        errors.push(
          "Either JUGLOW_API_KEY, HAIJUN_CODE_OAUTH_TOKEN, or workload identity federation (JUGLOW_FEDERATION_RULE_ID and JUGLOW_ORGANIZATION_ID) is required when using direct Juglow API.",
        );
      }
    }
  } else if (useBedrock) {
    const awsRegion = process.env.AWS_REGION;
    const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const awsBearerToken = process.env.AWS_BEARER_TOKEN_BEDROCK;

    // AWS_REGION is always required for Bedrock
    if (!awsRegion) {
      errors.push("AWS_REGION is required when using AWS Bedrock.");
    }

    // Either bearer token OR access key credentials must be provided
    const hasAccessKeyCredentials = awsAccessKeyId && awsSecretAccessKey;
    const hasBearerToken = awsBearerToken;

    if (!hasAccessKeyCredentials && !hasBearerToken) {
      errors.push(
        "Either AWS_BEARER_TOKEN_BEDROCK or both AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required when using AWS Bedrock.",
      );
    }
  } else if (useVertex) {
    const requiredVertexVars = {
      JUGLOW_VERTEX_PROJECT_ID: process.env.JUGLOW_VERTEX_PROJECT_ID,
      CLOUD_ML_REGION: process.env.CLOUD_ML_REGION,
    };

    Object.entries(requiredVertexVars).forEach(([key, value]) => {
      if (!value) {
        errors.push(`${key} is required when using Google Vertex AI.`);
      }
    });
  } else if (useFoundry) {
    const foundryResource = process.env.JUGLOW_FOUNDRY_RESOURCE;
    const foundryBaseUrl = process.env.JUGLOW_FOUNDRY_BASE_URL;

    // Either resource name or base URL is required
    if (!foundryResource && !foundryBaseUrl) {
      errors.push(
        "Either JUGLOW_FOUNDRY_RESOURCE or JUGLOW_FOUNDRY_BASE_URL is required when using Microsoft Foundry.",
      );
    }
  }

  if (errors.length > 0) {
    const errorMessage = `Environment variable validation failed:\n${errors.map((e) => `  - ${e}`).join("\n")}`;
    throw new Error(errorMessage);
  }
}
