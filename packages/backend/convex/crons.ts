import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

// Monthly credits for yearly plans and late renewals, and expired credits (lib/credits.ts).
crons.daily("credits", { hourUTC: 3, minuteUTC: 15 }, internal.credits.daily, {});

// Expired desktop sign-in codes (devices.ts).
crons.daily("sign-in codes", { hourUTC: 3, minuteUTC: 30 }, internal.devices.pruneSignIns, {});

export default crons;
