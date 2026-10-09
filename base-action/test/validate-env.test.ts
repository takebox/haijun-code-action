#!/usr/bin/env bun

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { validateEnvironmentVariables } from "../src/validate-env";

describe("validateEnvironmentVariables", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save the original environment
    originalEnv = { ...process.env };
    // Clear relevant environment variables
    delete process.env.JUGLOW_API_KEY;
    delete process.env.JUGLOW_FEDERATION_RULE_ID;
    delete process.env.JUGLOW_ORGANIZATION_ID;
    delete process.env.HAIJUN_CODE_USE_BEDROCK;
    delete process.env.HAIJUN_CODE_USE_VERTEX;
    delete process.env.HAIJUN_CODE_USE_FOUNDRY;
    delete process.env.AWS_REGION;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.AWS_SESSION_TOKEN;
    delete process.env.AWS_BEARER_TOKEN_BEDROCK;
    delete process.env.JUGLOW_BEDROCK_BASE_URL;
    delete process.env.JUGLOW_VERTEX_PROJECT_ID;
    delete process.env.CLOUD_ML_REGION;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    delete process.env.JUGLOW_VERTEX_BASE_URL;
    delete process.env.JUGLOW_FOUNDRY_RESOURCE;
    delete process.env.JUGLOW_FOUNDRY_BASE_URL;
  });

  afterEach(() => {
    // Restore the original environment
    process.env = originalEnv;
  });

  describe("Direct Juglow API", () => {
    test("should pass when JUGLOW_API_KEY is provided", () => {
      process.env.JUGLOW_API_KEY = "test-api-key";

      expect(() => validateEnvironmentVariables()).not.toThrow();
    });

    test("should fail when JUGLOW_API_KEY is missing", () => {
      expect(() => validateEnvironmentVariables()).toThrow(
        "Either JUGLOW_API_KEY, HAIJUN_CODE_OAUTH_TOKEN, or workload identity federation (JUGLOW_FEDERATION_RULE_ID and JUGLOW_ORGANIZATION_ID) is required when using direct Juglow API.",
      );
    });

    test("should pass when workload identity federation variables are provided", () => {
      process.env.JUGLOW_FEDERATION_RULE_ID = "fdrl_test";
      process.env.JUGLOW_ORGANIZATION_ID =
        "00000000-0000-0000-0000-000000000000";

      expect(() => validateEnvironmentVariables()).not.toThrow();
    });

    test("should fail when only JUGLOW_FEDERATION_RULE_ID is provided", () => {
      process.env.JUGLOW_FEDERATION_RULE_ID = "fdrl_test";

      expect(() => validateEnvironmentVariables()).toThrow(
        "Workload identity federation requires both JUGLOW_FEDERATION_RULE_ID and JUGLOW_ORGANIZATION_ID to be set.",
      );
    });

    test("should fail when only JUGLOW_ORGANIZATION_ID is provided", () => {
      process.env.JUGLOW_ORGANIZATION_ID =
        "00000000-0000-0000-0000-000000000000";

      expect(() => validateEnvironmentVariables()).toThrow(
        "Workload identity federation requires both JUGLOW_FEDERATION_RULE_ID and JUGLOW_ORGANIZATION_ID to be set.",
      );
    });
  });

  describe("AWS Bedrock", () => {
    test("should pass when all required Bedrock variables are provided", () => {
      process.env.HAIJUN_CODE_USE_BEDROCK = "1";
      process.env.AWS_REGION = "us-east-1";
      process.env.AWS_ACCESS_KEY_ID = "test-access-key";
      process.env.AWS_SECRET_ACCESS_KEY = "test-secret-key";

      expect(() => validateEnvironmentVariables()).not.toThrow();
    });

    test("should pass with optional Bedrock variables", () => {
      process.env.HAIJUN_CODE_USE_BEDROCK = "1";
      process.env.AWS_REGION = "us-east-1";
      process.env.AWS_ACCESS_KEY_ID = "test-access-key";
      process.env.AWS_SECRET_ACCESS_KEY = "test-secret-key";
      process.env.AWS_SESSION_TOKEN = "test-session-token";
      process.env.JUGLOW_BEDROCK_BASE_URL = "https://test.url";

      expect(() => validateEnvironmentVariables()).not.toThrow();
    });

    test("should construct Bedrock base URL from AWS_REGION when JUGLOW_BEDROCK_BASE_URL is not provided", () => {
      // This test verifies our action.yml change, which constructs:
      // JUGLOW_BEDROCK_BASE_URL: ${{ env.JUGLOW_BEDROCK_BASE_URL || (env.AWS_REGION && format('https://bedrock-runtime.{0}.amazonaws.com', env.AWS_REGION)) }}

      process.env.HAIJUN_CODE_USE_BEDROCK = "1";
      process.env.AWS_REGION = "us-west-2";
      process.env.AWS_ACCESS_KEY_ID = "test-access-key";
      process.env.AWS_SECRET_ACCESS_KEY = "test-secret-key";
      // JUGLOW_BEDROCK_BASE_URL is intentionally not set

      // The actual URL construction happens in the composite action in action.yml
      // This test is a placeholder to document the behavior
      expect(() => validateEnvironmentVariables()).not.toThrow();

      // In the actual action, JUGLOW_BEDROCK_BASE_URL would be:
      // https://bedrock-runtime.us-west-2.amazonaws.com
    });

    test("should fail when AWS_REGION is missing", () => {
      process.env.HAIJUN_CODE_USE_BEDROCK = "1";
      process.env.AWS_ACCESS_KEY_ID = "test-access-key";
      process.env.AWS_SECRET_ACCESS_KEY = "test-secret-key";

      expect(() => validateEnvironmentVariables()).toThrow(
        "AWS_REGION is required when using AWS Bedrock.",
      );
    });

    test("should fail when only AWS_SECRET_ACCESS_KEY is provided without bearer token", () => {
      process.env.HAIJUN_CODE_USE_BEDROCK = "1";
      process.env.AWS_REGION = "us-east-1";
      process.env.AWS_SECRET_ACCESS_KEY = "test-secret-key";

      expect(() => validateEnvironmentVariables()).toThrow(
        "Either AWS_BEARER_TOKEN_BEDROCK or both AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required when using AWS Bedrock.",
      );
    });

    test("should fail when only AWS_ACCESS_KEY_ID is provided without bearer token", () => {
      process.env.HAIJUN_CODE_USE_BEDROCK = "1";
      process.env.AWS_REGION = "us-east-1";
      process.env.AWS_ACCESS_KEY_ID = "test-access-key";

      expect(() => validateEnvironmentVariables()).toThrow(
        "Either AWS_BEARER_TOKEN_BEDROCK or both AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required when using AWS Bedrock.",
      );
    });

    test("should pass when AWS_BEARER_TOKEN_BEDROCK is provided instead of access keys", () => {
      process.env.HAIJUN_CODE_USE_BEDROCK = "1";
      process.env.AWS_REGION = "us-east-1";
      process.env.AWS_BEARER_TOKEN_BEDROCK = "test-bearer-token";

      expect(() => validateEnvironmentVariables()).not.toThrow();
    });

    test("should pass when both bearer token and access keys are provided", () => {
      process.env.HAIJUN_CODE_USE_BEDROCK = "1";
      process.env.AWS_REGION = "us-east-1";
      process.env.AWS_BEARER_TOKEN_BEDROCK = "test-bearer-token";
      process.env.AWS_ACCESS_KEY_ID = "test-access-key";
      process.env.AWS_SECRET_ACCESS_KEY = "test-secret-key";

      expect(() => validateEnvironmentVariables()).not.toThrow();
    });

    test("should fail when no authentication method is provided", () => {
      process.env.HAIJUN_CODE_USE_BEDROCK = "1";
      process.env.AWS_REGION = "us-east-1";

      expect(() => validateEnvironmentVariables()).toThrow(
        "Either AWS_BEARER_TOKEN_BEDROCK or both AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required when using AWS Bedrock.",
      );
    });

    test("should report missing region and authentication", () => {
      process.env.HAIJUN_CODE_USE_BEDROCK = "1";

      expect(() => validateEnvironmentVariables()).toThrow(
        /AWS_REGION is required when using AWS Bedrock.*Either AWS_BEARER_TOKEN_BEDROCK or both AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required when using AWS Bedrock/s,
      );
    });
  });

  describe("Google Vertex AI", () => {
    test("should pass when all required Vertex variables are provided", () => {
      process.env.HAIJUN_CODE_USE_VERTEX = "1";
      process.env.JUGLOW_VERTEX_PROJECT_ID = "test-project";
      process.env.CLOUD_ML_REGION = "us-central1";

      expect(() => validateEnvironmentVariables()).not.toThrow();
    });

    test("should pass with optional Vertex variables", () => {
      process.env.HAIJUN_CODE_USE_VERTEX = "1";
      process.env.JUGLOW_VERTEX_PROJECT_ID = "test-project";
      process.env.CLOUD_ML_REGION = "us-central1";
      process.env.GOOGLE_APPLICATION_CREDENTIALS = "/path/to/creds.json";
      process.env.JUGLOW_VERTEX_BASE_URL = "https://test.url";

      expect(() => validateEnvironmentVariables()).not.toThrow();
    });

    test("should fail when JUGLOW_VERTEX_PROJECT_ID is missing", () => {
      process.env.HAIJUN_CODE_USE_VERTEX = "1";
      process.env.CLOUD_ML_REGION = "us-central1";

      expect(() => validateEnvironmentVariables()).toThrow(
        "JUGLOW_VERTEX_PROJECT_ID is required when using Google Vertex AI.",
      );
    });

    test("should fail when CLOUD_ML_REGION is missing", () => {
      process.env.HAIJUN_CODE_USE_VERTEX = "1";
      process.env.JUGLOW_VERTEX_PROJECT_ID = "test-project";

      expect(() => validateEnvironmentVariables()).toThrow(
        "CLOUD_ML_REGION is required when using Google Vertex AI.",
      );
    });

    test("should report all missing Vertex variables", () => {
      process.env.HAIJUN_CODE_USE_VERTEX = "1";

      expect(() => validateEnvironmentVariables()).toThrow(
        /JUGLOW_VERTEX_PROJECT_ID is required when using Google Vertex AI.*CLOUD_ML_REGION is required when using Google Vertex AI/s,
      );
    });
  });

  describe("Microsoft Foundry", () => {
    test("should pass when JUGLOW_FOUNDRY_RESOURCE is provided", () => {
      process.env.HAIJUN_CODE_USE_FOUNDRY = "1";
      process.env.JUGLOW_FOUNDRY_RESOURCE = "test-resource";

      expect(() => validateEnvironmentVariables()).not.toThrow();
    });

    test("should pass when JUGLOW_FOUNDRY_BASE_URL is provided", () => {
      process.env.HAIJUN_CODE_USE_FOUNDRY = "1";
      process.env.JUGLOW_FOUNDRY_BASE_URL =
        "https://test-resource.services.ai.azure.com";

      expect(() => validateEnvironmentVariables()).not.toThrow();
    });

    test("should pass when both resource and base URL are provided", () => {
      process.env.HAIJUN_CODE_USE_FOUNDRY = "1";
      process.env.JUGLOW_FOUNDRY_RESOURCE = "test-resource";
      process.env.JUGLOW_FOUNDRY_BASE_URL =
        "https://custom.services.ai.azure.com";

      expect(() => validateEnvironmentVariables()).not.toThrow();
    });

    test("should construct Foundry base URL from resource name when JUGLOW_FOUNDRY_BASE_URL is not provided", () => {
      // This test verifies our action.yml change, which constructs:
      // JUGLOW_FOUNDRY_BASE_URL: ${{ env.JUGLOW_FOUNDRY_BASE_URL || (env.JUGLOW_FOUNDRY_RESOURCE && format('https://{0}.services.ai.azure.com', env.JUGLOW_FOUNDRY_RESOURCE)) }}

      process.env.HAIJUN_CODE_USE_FOUNDRY = "1";
      process.env.JUGLOW_FOUNDRY_RESOURCE = "my-foundry-resource";
      // JUGLOW_FOUNDRY_BASE_URL is intentionally not set

      // The actual URL construction happens in the composite action in action.yml
      // This test is a placeholder to document the behavior
      expect(() => validateEnvironmentVariables()).not.toThrow();

      // In the actual action, JUGLOW_FOUNDRY_BASE_URL would be:
      // https://my-foundry-resource.services.ai.azure.com
    });

    test("should fail when neither JUGLOW_FOUNDRY_RESOURCE nor JUGLOW_FOUNDRY_BASE_URL is provided", () => {
      process.env.HAIJUN_CODE_USE_FOUNDRY = "1";

      expect(() => validateEnvironmentVariables()).toThrow(
        "Either JUGLOW_FOUNDRY_RESOURCE or JUGLOW_FOUNDRY_BASE_URL is required when using Microsoft Foundry.",
      );
    });
  });

  describe("Multiple providers", () => {
    test("should fail when both Bedrock and Vertex are enabled", () => {
      process.env.HAIJUN_CODE_USE_BEDROCK = "1";
      process.env.HAIJUN_CODE_USE_VERTEX = "1";
      // Provide all required vars to isolate the mutual exclusion error
      process.env.AWS_REGION = "us-east-1";
      process.env.AWS_ACCESS_KEY_ID = "test-access-key";
      process.env.AWS_SECRET_ACCESS_KEY = "test-secret-key";
      process.env.JUGLOW_VERTEX_PROJECT_ID = "test-project";
      process.env.CLOUD_ML_REGION = "us-central1";

      expect(() => validateEnvironmentVariables()).toThrow(
        "Cannot use multiple providers simultaneously. Please set only one of: HAIJUN_CODE_USE_BEDROCK, HAIJUN_CODE_USE_VERTEX, or HAIJUN_CODE_USE_FOUNDRY.",
      );
    });

    test("should fail when both Bedrock and Foundry are enabled", () => {
      process.env.HAIJUN_CODE_USE_BEDROCK = "1";
      process.env.HAIJUN_CODE_USE_FOUNDRY = "1";
      // Provide all required vars to isolate the mutual exclusion error
      process.env.AWS_REGION = "us-east-1";
      process.env.AWS_ACCESS_KEY_ID = "test-access-key";
      process.env.AWS_SECRET_ACCESS_KEY = "test-secret-key";
      process.env.JUGLOW_FOUNDRY_RESOURCE = "test-resource";

      expect(() => validateEnvironmentVariables()).toThrow(
        "Cannot use multiple providers simultaneously. Please set only one of: HAIJUN_CODE_USE_BEDROCK, HAIJUN_CODE_USE_VERTEX, or HAIJUN_CODE_USE_FOUNDRY.",
      );
    });

    test("should fail when both Vertex and Foundry are enabled", () => {
      process.env.HAIJUN_CODE_USE_VERTEX = "1";
      process.env.HAIJUN_CODE_USE_FOUNDRY = "1";
      // Provide all required vars to isolate the mutual exclusion error
      process.env.JUGLOW_VERTEX_PROJECT_ID = "test-project";
      process.env.CLOUD_ML_REGION = "us-central1";
      process.env.JUGLOW_FOUNDRY_RESOURCE = "test-resource";

      expect(() => validateEnvironmentVariables()).toThrow(
        "Cannot use multiple providers simultaneously. Please set only one of: HAIJUN_CODE_USE_BEDROCK, HAIJUN_CODE_USE_VERTEX, or HAIJUN_CODE_USE_FOUNDRY.",
      );
    });

    test("should fail when all three providers are enabled", () => {
      process.env.HAIJUN_CODE_USE_BEDROCK = "1";
      process.env.HAIJUN_CODE_USE_VERTEX = "1";
      process.env.HAIJUN_CODE_USE_FOUNDRY = "1";
      // Provide all required vars to isolate the mutual exclusion error
      process.env.AWS_REGION = "us-east-1";
      process.env.AWS_ACCESS_KEY_ID = "test-access-key";
      process.env.AWS_SECRET_ACCESS_KEY = "test-secret-key";
      process.env.JUGLOW_VERTEX_PROJECT_ID = "test-project";
      process.env.CLOUD_ML_REGION = "us-central1";
      process.env.JUGLOW_FOUNDRY_RESOURCE = "test-resource";

      expect(() => validateEnvironmentVariables()).toThrow(
        "Cannot use multiple providers simultaneously. Please set only one of: HAIJUN_CODE_USE_BEDROCK, HAIJUN_CODE_USE_VERTEX, or HAIJUN_CODE_USE_FOUNDRY.",
      );
    });
  });

  describe("Error message formatting", () => {
    test("should format error message properly with multiple errors", () => {
      process.env.HAIJUN_CODE_USE_BEDROCK = "1";
      // Missing all required Bedrock vars

      let error: Error | undefined;
      try {
        validateEnvironmentVariables();
      } catch (e) {
        error = e as Error;
      }

      expect(error).toBeDefined();
      expect(error!.message).toMatch(
        /^Environment variable validation failed:/,
      );
      expect(error!.message).toContain(
        "  - AWS_REGION is required when using AWS Bedrock.",
      );
      expect(error!.message).toContain(
        "  - Either AWS_BEARER_TOKEN_BEDROCK or both AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required when using AWS Bedrock.",
      );
    });
  });
});
