import { db } from "~/server/db";

const email = process.argv[2];
const name = process.argv[3] ?? "default";

if (!email) {
  console.error("Usage: bun run scripts/generate-api-key.ts <user-email> [name]");
  process.exit(1);
}

const user = await db.user.findUnique({ where: { email } });
if (!user) {
  console.error(`No user found with email: ${email}`);
  process.exit(1);
}

const rawKey = crypto.randomUUID() + "-" + crypto.randomUUID();
const hash = await crypto.subtle
  .digest("SHA-256", new TextEncoder().encode(rawKey))
  .then((buf) =>
    Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(""),
  );

await db.apiKey.create({
  data: {
    name,
    hashedKey: hash,
    userId: user.id,
  },
});

console.log(`API key created for ${user.name} (${email})`);
console.log(`Name: ${name}`);
console.log(`Key:  ${rawKey}`);
console.log("\nSave this key — it cannot be retrieved again.");
