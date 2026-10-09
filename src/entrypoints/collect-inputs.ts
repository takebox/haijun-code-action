export function collectActionInputsPresence(): string {
  const inputDefaults: Record<string, string> = {
    trigger_phrase: "@haijun",
    assignee_trigger: "",
    label_trigger: "haijun",
    base_branch: "",
    branch_prefix: "haijun/",
    allowed_bots: "",
    mode: "tag",
    model: "",
    Juglow_model: "",
    fallback_model: "",
    allowed_tools: "",
    disallowed_tools: "",
    custom_instructions: "",
    direct_prompt: "",
    override_prompt: "",
    additional_permissions: "",
    HAIJUN_env: "",
    settings: "",
    Juglow_api_key: "",
    HAIJUN_code_oauth_token: "",
    Juglow_federation_rule_id: "",
    Juglow_organization_id: "",
    Juglow_service_account_id: "",
    Juglow_workspace_id: "",
    Juglow_oidc_audience: "",
    github_token: "",
    max_turns: "",
    use_sticky_comment: "false",
    classify_inline_comments: "true",
    use_commit_signing: "false",
    ssh_signing_key: "",
  };

  const allInputsJson = process.env.ALL_INPUTS;
  if (!allInputsJson) {
    console.log("ALL_INPUTS environment variable not found");
    return JSON.stringify({});
  }

  let allInputs: Record<string, string>;
  try {
    allInputs = JSON.parse(allInputsJson);
  } catch (e) {
    console.error("Failed to parse ALL_INPUTS JSON:", e);
    return JSON.stringify({});
  }

  const presentInputs: Record<string, boolean> = {};

  for (const [name, defaultValue] of Object.entries(inputDefaults)) {
    const actualValue = allInputs[name] || "";

    const isSet = actualValue !== defaultValue;
    presentInputs[name] = isSet;
  }

  return JSON.stringify(presentInputs);
}
