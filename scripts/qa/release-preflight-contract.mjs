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
  inquiryDelivery: ["DATABASE_URL", "TURNSTILE_SECRET_KEY", "TURNSTILE_ALLOWED_HOSTNAMES", "CONTACT_ALLOWED_ORIGINS", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "QSTASH_TOKEN", "QSTASH_CURRENT_SIGNING_KEY", "QSTASH_NEXT_SIGNING_KEY", "LEAD_PSEUDONYM_SECRET", "RESEND_API_KEY", "LEAD_EMAIL_FROM", "LEAD_EMAIL_TO", "RESEND_WEBHOOK_SECRET"],
  independentMonitoring: ["CRON_SECRET", "LEAD_OPERATIONS_SECRET", "LEAD_ALERT_WEBHOOK_URL"],
  staffedStaging: ["STAGING_BASE_URL", "STAGING_DATABASE_URL", "STAGING_CANARY_AUTHORIZED_ORIGIN", "STAGING_CANARY_AUTHORIZED", "STAGING_CANARY_EMAIL", "STAGING_CANARY_DELIVERY_EMAIL", "STAGING_CANARY_OPERATOR_REFERENCE", "STAGING_CANARY_EXPECTED_ATTESTATION_SHA256", "STAGING_CANARY_PREFLIGHT_TOKEN"],
}

/** Inspect only the supplied process environment. Never load .env.example as real
 * configuration or return values, endpoint URLs, recipient addresses or secrets. */
export function inspectReleaseEnvironment(env) {
  const groups = Object.fromEntries(Object.entries(CONFIGURATION_GROUPS).map(([group, names]) => [group, {
    variables: names.map(name => ({ name, present: typeof env[name] === "string" && env[name].trim().length > 0 })),
    note: "Presence only; credentials, isolation, ownership and provider behavior are unverified.",
  }]))
  const siteKey = env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? ""
  return {
    groups,
    effectiveBuildConfiguration: {
      observability: env.VERCEL === "1",
      httpsPolicy: env.VERCEL === "1" || env.GRIDNINJA_HTTPS === "1",
      verification: !siteKey ? "unconfigured" : /^[123]x0+[A-Z]{2}$/.test(siteKey) ? "test" : "live",
      csp: !env.GRIDNINJA_CSP_MODE || env.GRIDNINJA_CSP_MODE === "enforce" ? "enforce" : env.GRIDNINJA_CSP_MODE === "report-only" ? "report-only" : "invalid",
    },
  }
}
