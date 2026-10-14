/** These checks establish prerequisites, never hosted execution or release approval. */
export function productionQualificationIssues(settings) {
  const issues = []
  if (settings?.privateCandidate) issues.push("private-candidate-is-not-release-approved")
  if (settings?.observability !== true) issues.push("production-observability-not-in-build")
  if (settings?.httpsPolicy !== true) issues.push("https-policy-not-in-build")
  if (settings?.verification !== "live") issues.push("live-verification-not-in-build")
  if (settings?.csp !== "enforce") issues.push("enforced-csp-not-in-build")
  return issues
}

const CONFIGURATION_GROUPS = {
  productionBuild: ["NEXT_PUBLIC_TURNSTILE_SITE_KEY"],
  inquiryDelivery: ["DATABASE_URL", "TURNSTILE_SECRET_KEY", "TURNSTILE_ALLOWED_HOSTNAMES", "CONTACT_ALLOWED_ORIGINS", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "QSTASH_TOKEN", "QSTASH_CURRENT_SIGNING_KEY", "QSTASH_NEXT_SIGNING_KEY", "LEAD_PSEUDONYM_SECRET", "RESEND_API_KEY", "RESEND_ACCOUNT_REF", "RESEND_ACCOUNT_BINDING_REF", "RESEND_APPROVED_KEY_SHA256", "LEAD_EMAIL_FROM", "LEAD_EMAIL_TO", "RESEND_WEBHOOK_SECRET"],
  independentMonitoring: ["LEAD_MONITOR_SECRET", "LEAD_MONITOR_NAMESPACE", "LEAD_OPERATIONS_SECRET", "LEAD_ALERT_WEBHOOK_URL", "LEAD_ALERT_WEBHOOK_TOKEN", "LEAD_OPERATOR_REFERENCES", "LEAD_RECIPIENT_OBSERVATION_SECONDS", "LEAD_HANDLING_SECONDS"],
  staffedStaging: ["STAGING_BASE_URL", "STAGING_DATABASE_URL", "STAGING_CANARY_AUTHORIZED_ORIGIN", "STAGING_CANARY_AUTHORIZED", "STAGING_CANARY_EMAIL", "STAGING_CANARY_DELIVERY_EMAIL", "STAGING_CANARY_OPERATOR_REFERENCE", "STAGING_CANARY_EXPECTED_ATTESTATION_SHA256", "STAGING_CANARY_APPROVAL_FILE", "STAGING_CANARY_APPROVAL_SHA256", "STAGING_CANARY_DEPLOYMENT_BYPASS", "STAGING_CANARY_MONITOR_SECRET", "STAGING_CANARY_ACK_TIMEOUT_SECONDS"],
}

/** Inspect only the supplied process environment. Never load .env.example as real
 * configuration or return values, endpoint URLs, recipient addresses or secrets. */
export function inspectReleaseEnvironment(env) {
  const conditional = {
    callbackRotation: env.RESEND_WEBHOOK_SECRET_PREVIOUS ? ["RESEND_WEBHOOK_SECRET_PREVIOUS", "RESEND_WEBHOOK_PREVIOUS_ACCOUNT_REF"] : [],
    optionalCrm: env.LEAD_WEBHOOK_ENABLED === "true" ? ["LEAD_WEBHOOK_ENABLED", "LEAD_WEBHOOK_URL", "LEAD_WEBHOOK_SIGNING_SECRET", "LEAD_WEBHOOK_ACCOUNT_REF", "LEAD_WEBHOOK_CONTRACT_REF", "LEAD_WEBHOOK_DEDUPLICATION_HOURS"] : [],
  }
  const groups = Object.fromEntries(Object.entries({ ...CONFIGURATION_GROUPS, ...conditional }).map(([group, names]) => [group, {
    variables: names.map(name => ({ name, present: typeof env[name] === "string" && env[name].trim().length > 0 })),
    note: "Presence only; credentials, isolation, ownership and provider behavior are unverified.",
  }]))
  const siteKey = env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? ""
  return {
    groups,
    credentialsVerified: false,
    isolationVerified: false,
    activationReady: false,
    effectiveBuildConfiguration: {
      observability: env.VERCEL === "1",
      httpsPolicy: env.VERCEL === "1" || env.GRIDNINJA_HTTPS === "1",
      verification: !siteKey ? "unconfigured" : /^[123]x0+[A-Z]{2}$/.test(siteKey) ? "test" : "live",
      csp: !env.GRIDNINJA_CSP_MODE || env.GRIDNINJA_CSP_MODE === "enforce" ? "enforce" : env.GRIDNINJA_CSP_MODE === "report-only" ? "report-only" : "invalid",
    },
  }
}
