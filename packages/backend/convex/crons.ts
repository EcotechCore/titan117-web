import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

// Monthly credits for yearly plans and late renewals, and expired credits (lib/credits.ts).
crons.daily("credits", { hourUTC: 3, minuteUTC: 15 }, internal.credits.daily, {});

// Expired desktop sign-in codes (devices.ts).
crons.daily("sign-in codes", { hourUTC: 3, minuteUTC: 30 }, internal.devices.pruneSignIns, {});

// Accounts whose 30 days after asking for deletion are over (account.ts).
crons.daily("account deletion", { hourUTC: 4, minuteUTC: 0 }, internal.account.purgeDue, {});

// Error reports older than 90 days (errorReports.ts, decisions §22).
crons.daily("error reports", { hourUTC: 4, minuteUTC: 30 }, internal.errorReports.prune, {});

// Remote messages past their expiry and old pairings (remote.ts, decisions §64).
crons.hourly("remote messages", { minuteUTC: 10 }, internal.remote.prune, {});

// Sync packages nobody read in 30 days (sync.ts, decisions §65.6).
crons.daily("sync packages", { hourUTC: 5, minuteUTC: 0 }, internal.sync.prune, {});

// The marketplace's listing from GitHub's topic (market.ts, decisions §66.3).
crons.hourly("marketplace index", { minuteUTC: 40 }, internal.market.refresh, {});

export default crons;
