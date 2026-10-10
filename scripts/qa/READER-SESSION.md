# Isolated reader sessions

This local QA proxy supplies the participant protocol's mock-intake environment. It is prepared infrastructure, not a record of completed sessions. It does not start, stop or deploy the candidate, change its files/schema, deliver email or contact an inquiry backend. No tunnel or remote hosting is configured.

Start a reviewed production candidate independently on a literal loopback address. Build it with the public Cloudflare test key `NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA`; the form requires a nonempty compiled key even though verification is simulated. Do not give the study server production credentials. Then, using repository Node 22:

```sh
node scripts/qa/reader-session.mjs --upstream http://127.0.0.1:3101 --port 3102 --minutes 45
```

Open the exact printed address, normally `http://127.0.0.1:3102`. The proxy expires after 45 minutes by default (1–120 minutes supported), or stops on Ctrl-C/SIGTERM. It closes only its own listener, sockets and upstream requests; the candidate stays running. Request/read timeouts and a 16 KiB contact-body limit bound individual requests. The listener uses loopback unless an explicit private LAN address is supplied.

For the available iPhone, LAN HTTP is insufficient: the unchanged production form uses secure-context Web Crypto. An explicitly supplied TLS certificate/key **already trusted by the device and valid for the chosen local IP address** is required:

```sh
node scripts/qa/reader-session.mjs --upstream http://127.0.0.1:3101 --lan-host 192.168.1.20 --port 3102 --tls-cert /private/study-cert.pem --tls-key /private/study-key.pem --minutes 45
```

The LAN address must belong to a local interface. Certificate provisioning, installation/trust and device settings are not automated; availability and physical iPhone testing remain pending. Use a trusted study network and synthetic details only. This tool provides no authentication for other devices on that LAN. Remote participants need a separately prepared, accessible isolated host; this listener alone does not make the study remotely available.

## Before each session

Record candidate SHA/build, proxy version, device and connection in the private session record. Confirm the visible **TEST / STUDY** banner. Use fictional names/organization and the protocol's `operator@example.test` address (example.test and example.com/org/net addresses are accepted). Complete a facilitator dry run: verification must say it is simulated, submission must show **STUDY RECEIPT — not a real inquiry**, and no form data may appear in the terminal. A candidate built without the public test key cannot complete this mock form; do not bypass the form to count task success. Browser hydration and this end-to-end mock form must be checked against the final candidate before using the harness with participants; request-boundary tests alone do not establish that the injected banner/receipt labeling works with that candidate.

The proxy forwards GET/HEAD only to the explicitly configured loopback candidate. All API requests, telemetry paths and mutations are denied, except `/api/contact` POST which returns a constant synthetic UUID in the existing 202/`queued` receipt shape. It discards the bounded request body without persisting or logging it. This does not reproduce production validation, spam defenses, durable storage, email delivery or idempotency, so the study cannot validate those systems.

Marketing HTML gets a QA-only bootstrap, a no-store/noindex policy and a restrictive same-origin CSP. The bootstrap stubs verification, labels in-page and recovered receipts, adds the persistent study banner and intercepts ordinary external-link clicks. This is not a browser-wide navigation sandbox: manual navigation and context-menu actions can leave the study, so the synthetic-only protocol remains authoritative. The original frozen HTML briefs, publication releases, download bytes and static asset headers are passed through without bootstrap/CSP rewriting. They retain their own publication identity; do not mistake a frozen synthetic brief for a study submission receipt. External research-navigation usability is not covered while external clicks are disabled.

The frozen v1.0.0 HTML brief's assessment CTA is an absolute production URL. Before every session, explicitly instruct participants to use browser Back from that brief to the local study page and its local assessment link; confirm the TEST / STUDY banner before entering or submitting fictional details. Never submit on production. Record this instruction and any navigation intervention as assistance; the frozen-brief-to-assessment path cannot be claimed as fully isolated or unassisted seamless completion. Preserve the brief bytes. The participant protocol and session template retain this environment limitation separately from production-site functionality.

The banner and simulated verification alter the study environment. Record those differences; proxy sessions cannot qualify production performance, security, accessibility conformance or physical-device behavior of an unmodified deployment. Browser-local recovery storage may contain mock receipt IDs until its normal expiry; use a separate study browser profile/tab and follow the participant protocol's private-data handling. No participant names, recordings, actual results or private form bodies belong in this repository.

Three focused request-boundary tests cover loopback/LAN constraints and lifetime cleanup; mock/denied mutations including encoded API paths; and marketing transformation versus preserved publication/static delivery. Final candidate qualification and actual reader sessions remain separate.

An automated Chromium dry run on 10 October 2026 against build `LIXE5H-r2PLHUDT_hn9Gg` found and corrected an omitted read-only `next-router-segment-prefetch` header that caused repeated prefetch retries. The failed receipt is preserved under `build/premium-civic/journey-review/final-fa933dc-study-01/`; the follow-up under `final-fa933dc-study-02/` verifies both synthetic receipt views, no page/hydration errors, only one local mocked POST, frozen brief byte/CSP preservation, and no external browser requests. That is a harness check on the named prior candidate, not completed reader/device sessions or qualification of a later build. Repeat the facilitator dry run after candidate changes.
