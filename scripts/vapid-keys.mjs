// Makes the VAPID key pair for Web Push (decisions §64.10) and prints the two
// lines to put in the Convex deployment's environment. Run once per
// deployment; never commit the output (guardrails §8).
//
//   node scripts/vapid-keys.mjs
//   npx convex env set VAPID_PRIVATE_KEY <value>   (in packages/backend)
//   npx convex env set VAPID_PUBLIC_KEY <value>
const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
const b64 = (b) => Buffer.from(b).toString('base64url')
console.log(`VAPID_PRIVATE_KEY=${b64(await crypto.subtle.exportKey('pkcs8', pair.privateKey))}`)
console.log(`VAPID_PUBLIC_KEY=${b64(await crypto.subtle.exportKey('raw', pair.publicKey))}`)
