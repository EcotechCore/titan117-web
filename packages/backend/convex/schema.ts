import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Every table here needs a row in the data table in docs/notes/decisions.md §11,
 * naming its item on the §32 list. checks/guardrails.test.ts fails when one is missing.
 */
const plan = v.union(v.literal("starter"), v.literal("pro"), v.literal("max"), v.literal("custom"));

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    // Set only from the Convex CLI (guardrails §12b), never from a screen.
    role: v.optional(v.literal("admin")),
    // Account deletion (account.ts): when it happens, and whether asking for it stopped the plan renewing.
    deleteAfter: v.optional(v.number()),
    deletionStoppedRenewal: v.optional(v.boolean()),
    // "Revoke all devices" (decisions §64.8): laptops unlink their chat channels and rotate their keys when they see it.
    remoteRevokedAllAt: v.optional(v.number()),
    // Staff (role admin) confirmed a fresh second factor at this time (decisions §65.8); admits them for 8 hours.
    staffSecondFactorAt: v.optional(v.number()),
    // Sync between laptops (decisions §65.5–6): the sync key's current generation, when a laptop last
    // asked every laptop to send everything again, and the highest package dropped at 30 days unread.
    syncKeyGen: v.optional(v.number()),
    syncResendAt: v.optional(v.number()),
    syncExpiredTop: v.optional(v.number()),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_deleteAfter", ["deleteAfter"]),

  // Written only by the payment webhook and the credit grants it starts (guardrails §3).
  entitlements: defineTable({
    userId: v.id("users"),
    plan,
    // The paid period's end plus a short grace while Stripe retries a failed payment.
    activeUntil: v.number(),
    subscriptionId: v.optional(v.string()),
    status: v.optional(v.string()),
    interval: v.optional(v.union(v.literal("month"), v.literal("year"))),
    cancelAtPeriodEnd: v.optional(v.boolean()),
    // End of the period Stripe has been paid for (no grace).
    paidUntil: v.optional(v.number()),
    // Monthly credits: month k of the subscription starts at grantAnchor + k months.
    grantAnchor: v.optional(v.number()),
    grantsMade: v.optional(v.number()),
    // When the next month's credits are due; absent when none are.
    nextGrantAt: v.optional(v.number()),
    // The plan whose allowance this month's grant used, for prorated upgrades.
    grantedPlan: v.optional(plan),
  })
    .index("by_user", ["userId"])
    .index("by_nextGrantAt", ["nextGrantAt"]),

  /**
   * A user's signed-in desktop apps (§32: devices). The device token itself is
   * only on the laptop, in the OS keychain; we keep its SHA-256.
   */
  devices: defineTable({
    userId: v.id("users"),
    name: v.string(),
    revokedAt: v.optional(v.number()),
    tokenHash: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    lastSeenAt: v.optional(v.number()),
    appVersion: v.optional(v.string()),
    // SHA-256 of the app install's random ID (the ID itself stays on the laptop):
    // signing in again from the same install replaces its device instead of adding one.
    installHash: v.optional(v.string()),
    // Remote control (decisions §64.5): switched on with a fresh second factor;
    // the laptop's own setting decides too, and switching off there clears it.
    remoteEnabledAt: v.optional(v.number()),
    // A paired browser or phone just sent something: the laptop looks more often for a while.
    remoteWakeAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_tokenHash", ["tokenHash"]),

  /**
   * Remote control keys (§32: devices; decisions §64.2): public keys only.
   * A laptop's row has its device; a browser's or phone's was added by a
   * pairing the laptop confirmed. The key itself is the id on the wire.
   */
  deviceKeys: defineTable({
    userId: v.id("users"),
    kind: v.union(v.literal("laptop"), v.literal("browser"), v.literal("phone")),
    deviceId: v.optional(v.id("devices")),
    name: v.string(),
    publicKey: v.string(),
    createdAt: v.number(),
    revokedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_publicKey", ["publicKey"])
    .index("by_device", ["deviceId"]),

  /** Pairings in progress (decisions §64.6): five minutes, used once, confirmed on the laptop. */
  pairings: defineTable({
    userId: v.id("users"),
    deviceId: v.id("devices"),
    laptopKey: v.string(),
    expiresAt: v.number(),
    status: v.union(v.literal("open"), v.literal("claimed"), v.literal("confirmed"), v.literal("refused")),
    claimedKey: v.optional(v.string()),
    claimedName: v.optional(v.string()),
  })
    .index("by_device", ["deviceId"])
    .index("by_expiresAt", ["expiresAt"])
    .index("by_user", ["userId"]),

  /**
   * Web Push for a paired browser or phone (§32: devices; decisions §64.10):
   * only the push service's address for it. Pushes carry no content, so the
   * subscription's encryption keys aren't kept.
   */
  pushSubscriptions: defineTable({
    userId: v.id("users"),
    deviceKey: v.string(),
    endpoint: v.string(),
    createdAt: v.number(),
    lastPushAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_deviceKey", ["deviceKey"]),

  /**
   * Sync between the user's laptops (§32: devices; decisions §65.4–6): each
   * laptop that switched sync on, its sync public key, whether it's in, and
   * the account's sync key sealed to it. Convex can't open that key.
   */
  syncMembers: defineTable({
    userId: v.id("users"),
    deviceId: v.id("devices"),
    name: v.string(),
    publicKey: v.string(),
    status: v.union(v.literal("waiting"), v.literal("in")),
    createdAt: v.number(),
    // The sync key sealed to this laptop by a laptop already in (header kind "sync").
    sealedKey: v.optional(v.string()),
    sealedBy: v.optional(v.string()),
    keyMsgId: v.optional(v.string()),
    keyGen: v.optional(v.number()),
    // The last package this laptop has read.
    cursor: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_device", ["deviceId"]),

  /**
   * Synced changes (§32: sync, end to end encrypted; decisions §58.7, §65.6):
   * sealed packages in file storage with routing fields only. Deleted once
   * every laptop in has read them, at 30 days, and with the account.
   */
  syncChanges: defineTable({
    userId: v.id("users"),
    deviceId: v.id("devices"),
    seq: v.number(),
    keyGen: v.number(),
    size: v.number(),
    storageId: v.id("_storage"),
    createdAt: v.number(),
  })
    .index("by_user", ["userId", "seq"])
    .index("by_user_time", ["userId", "createdAt"])
    .index("by_createdAt", ["createdAt"]),

  /**
   * Remote messages (§32 item 4; decisions §64.3): ciphertext and routing
   * fields only. Deleted once the recipient has them, at expiry, on Revoke
   * all and with the account.
   */
  remoteMessages: defineTable({
    userId: v.id("users"),
    from: v.string(),
    to: v.string(),
    kind: v.union(v.literal("command"), v.literal("event"), v.literal("key")),
    msgId: v.string(),
    sealed: v.string(),
    size: v.number(),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_to", ["to", "createdAt"])
    .index("by_user", ["userId", "createdAt"])
    .index("by_msgId", ["msgId"])
    .index("by_expiresAt", ["expiresAt"]),

  /**
   * Desktop sign-ins in progress: a one-time code (stored hashed) the web
   * page hands to the app on this laptop, bound to the app's PKCE challenge.
   * Lives five minutes.
   */
  deviceSignIns: defineTable({
    userId: v.id("users"),
    codeHash: v.string(),
    challenge: v.string(),
    name: v.string(),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
    installHash: v.optional(v.string()),
  })
    .index("by_codeHash", ["codeHash"])
    .index("by_expiresAt", ["expiresAt"])
    .index("by_user", ["userId"]),

  // The Stripe customer behind a user, created at their first Checkout.
  stripeCustomers: defineTable({
    userId: v.id("users"),
    customerId: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_customer", ["customerId"]),

  // Every Stripe event the webhook has handled, by id, so a repeated delivery is handled once.
  stripeEvents: defineTable({
    eventId: v.string(),
    type: v.string(),
    receivedAt: v.number(),
  })
    .index("by_eventId", ["eventId"])
    .index("by_receivedAt", ["receivedAt"]),

  /**
   * Credits a user can spend, one row per grant (pricing.md): this month's
   * allowance, last month's rolled-over credits, and top-ups. Spent in that
   * order, top-ups oldest first, skipping expired rows.
   */
  creditBuckets: defineTable({
    userId: v.id("users"),
    kind: v.union(v.literal("monthly"), v.literal("rollover"), v.literal("topup")),
    granted: v.number(),
    remaining: v.number(),
    expiresAt: v.number(),
    // What created it: `month:<subscription>:<k>`, `rollover:<…>` or the Checkout session id.
    source: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_source", ["source"])
    .index("by_expiresAt", ["expiresAt"]),

  /**
   * Cloud calls through the credits proxy (§32: usage counts): who, which
   * model, when, and what it cost. Never the prompt or the answer. Open rows
   * limit how many calls a user runs at once.
   */
  proxyCalls: defineTable({
    userId: v.id("users"),
    model: v.string(),
    startedAt: v.number(),
    settledAt: v.optional(v.number()),
    credits: v.optional(v.number()),
    // A video job's id at OpenRouter (decisions §59.10): charged when the job ends, polled only by its owner.
    jobId: v.optional(v.string()),
  })
    .index("by_user_open", ["userId", "settledAt"])
    .index("by_job", ["jobId"])
    .index("by_startedAt", ["startedAt"]),

  /** Every change to a user's credits, for the credits page. Amounts are signed. */
  creditLedger: defineTable({
    userId: v.id("users"),
    amount: v.number(),
    reason: v.union(
      v.literal("monthly"),
      v.literal("upgrade"),
      v.literal("topup"),
      v.literal("usage"),
      v.literal("expired"),
    ),
    // For usage: the proxy's request id, so a retried charge counts once. Never prompt content.
    ref: v.optional(v.string()),
    // For usage: credits that were due but not there (the call had already run).
    shortfall: v.optional(v.number()),
    at: v.number(),
  })
    .index("by_user_at", ["userId", "at"])
    .index("by_ref", ["ref"]),

  /**
   * Artifacts a user chose to share by link (§32: what the user shares;
   * decisions §44). The snapshot is a self-contained HTML page in Convex file
   * storage; anyone with the random public id can view it until the owner
   * unshares it or staff take it down.
   */
  sharedArtifacts: defineTable({
    userId: v.id("users"),
    publicId: v.string(),
    title: v.string(),
    kind: v.string(),
    bytes: v.number(),
    storageId: v.optional(v.id("_storage")),
    createdAt: v.number(),
    // Set by staff (shares.takeDown); the snapshot is deleted, the row stays as the record.
    takenDownAt: v.optional(v.number()),
    takedownReason: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_publicId", ["publicId"]),

  /**
   * Reports about shared pages (§32: our own records; the Digital Services
   * Act's notice and action). No user link: the reporter may be anyone.
   */
  shareReports: defineTable({
    publicId: v.string(),
    reason: v.union(
      v.literal("illegal"),
      v.literal("privacy"),
      v.literal("copyright"),
      v.literal("abuse"),
      v.literal("other"),
    ),
    note: v.string(),
    email: v.optional(v.string()),
    at: v.number(),
    handledAt: v.optional(v.number()),
    decision: v.optional(v.union(v.literal("removed"), v.literal("kept"))),
  })
    .index("by_publicId", ["publicId"])
    .index("by_handledAt", ["handledAt"]),

  /**
   * Error reports the user chose to send (§32: reports the user sends;
   * decisions §22, §45): versions, OS, the feature, the error and stack, the
   * last redacted log lines and the user's note. Never files, prompts,
   * memory, keys or tokens. Kept 90 days; deleted with the account.
   */
  errorReports: defineTable({
    userId: v.id("users"),
    groupId: v.id("errorGroups"),
    // What the user is shown, e.g. T117-4F2A9C.
    ref: v.string(),
    appVersion: v.string(),
    os: v.string(),
    feature: v.string(),
    message: v.string(),
    stack: v.string(),
    logLines: v.array(v.string()),
    note: v.string(),
    at: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_group", ["groupId", "at"])
    .index("by_at", ["at"])
    .index("by_ref", ["ref"]),

  /** Reports grouped by signature (decisions §22): counts and versions, no user link. */
  errorGroups: defineTable({
    signature: v.string(),
    feature: v.string(),
    title: v.string(),
    count: v.number(),
    firstSeen: v.number(),
    lastSeen: v.number(),
    versions: v.array(v.string()),
    os: v.array(v.string()),
    // Set by staff when a release fixes it (19.5): the app then says "Fixed in 1.4".
    fixedIn: v.optional(v.string()),
    issueUrl: v.optional(v.string()),
  })
    .index("by_signature", ["signature"])
    .index("by_lastSeen", ["lastSeen"]),

  /**
   * Comments on shared pages (17.14; §32: what the user shares): written by
   * anyone with the link, or the owner's replies. Deleted with the page.
   */
  shareComments: defineTable({
    publicId: v.string(),
    name: v.string(),
    text: v.string(),
    fromOwner: v.boolean(),
    at: v.number(),
    // The owner hid it from the page.
    hiddenAt: v.optional(v.number()),
  }).index("by_publicId", ["publicId", "at"]),
});
