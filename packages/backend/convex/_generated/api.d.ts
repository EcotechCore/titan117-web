/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as account from "../account.js";
import type * as billing from "../billing.js";
import type * as credits from "../credits.js";
import type * as crons from "../crons.js";
import type * as devices from "../devices.js";
import type * as errorReports from "../errorReports.js";
import type * as http from "../http.js";
import type * as lib_billing from "../lib/billing.js";
import type * as lib_credits from "../lib/credits.js";
import type * as lib_functions from "../lib/functions.js";
import type * as lib_secondFactor from "../lib/secondFactor.js";
import type * as lib_stripe from "../lib/stripe.js";
import type * as lib_tokens from "../lib/tokens.js";
import type * as lib_webPush from "../lib/webPush.js";
import type * as proxy from "../proxy.js";
import type * as remote from "../remote.js";
import type * as shares from "../shares.js";
import type * as staff from "../staff.js";
import type * as sync from "../sync.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  account: typeof account;
  billing: typeof billing;
  credits: typeof credits;
  crons: typeof crons;
  devices: typeof devices;
  errorReports: typeof errorReports;
  http: typeof http;
  "lib/billing": typeof lib_billing;
  "lib/credits": typeof lib_credits;
  "lib/functions": typeof lib_functions;
  "lib/secondFactor": typeof lib_secondFactor;
  "lib/stripe": typeof lib_stripe;
  "lib/tokens": typeof lib_tokens;
  "lib/webPush": typeof lib_webPush;
  proxy: typeof proxy;
  remote: typeof remote;
  shares: typeof shares;
  staff: typeof staff;
  sync: typeof sync;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
