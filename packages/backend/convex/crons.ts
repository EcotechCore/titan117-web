import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

// Monthly credits for yearly plans and late renewals, and expired credits (lib/credits.ts).
crons.daily("credits", { hourUTC: 3, minuteUTC: 15 }, internal.credits.daily, {});

// Expired desktop sign-in codes (devices.ts).
crons.daily("sign-in codes", { hourUTC: 3, minuteUTC: 30 }, internal.devices.pruneSignIns, {});

// Accounts whose 30 days after asking for deletion are over (account.ts).
crons.daily("account deletion", { hourUTC: 4, minuteUTC: 0 }, internal.account.purgeDue, {});

export default crons;
