import jwt from "jsonwebtoken";
import { fetch } from "undici";
import { getStaticFiles, throwIfMissing } from "./utils.ts";

export default async ({ req, res, log, error }: any) => {
  throwIfMissing(Bun.env, [
    "VONAGE_API_KEY",
    "VONAGE_ACCOUNT_SECRET",
    "VONAGE_WHATSAPP_NUMBER",
    "VONAGE_SIGNATURE_SECRET",
  ]);

  if (req.method === "GET") {
    return res.send(getStaticFiles("index.html"), 200, {
      "Content-Type": "text/html; charset=utf-8",
    });
  }
  const authHeader: string = (req.headers.authorization ?? "").split(" ")[1];
  const decodedToken = jwt.verify(authHeader, Bun.env.VONAGE_SIGNATURE_SECRET, {
    algorithms: ["HS256"],
  });

  try {
    throwIfMissing(decodedToken, ["payload_hash"]);
  } catch (err) {
    return res.json({ ok: false, error: err.message }, 400);
  }

  const hasher = new Bun.CryptoHasher("sha256");
  const hashedValue = hasher.update(req.bodyRaw).digest("hex").toString();

  if (hashedValue != decodedToken["payload_hash"]) {
    return res.json({ ok: false, error: "Payload hash mismatched" }, 401);
  }

  try {
    throwIfMissing(req.body, ["from", "text"]);
  } catch (err) {
    return res.json({ ok: false, error: err.message }, 400);
  }

  const basicAuthToken: string = btoa(
    `${Bun.env.VONAGE_API_KEY}:${Bun.env.VONAGE_ACCOUNT_SECRET}`
  );

  if (req.body.text == null) {
    return res.json({ ok: true, status: req.body.status }, 200);
  }

  await fetch(`https://messages-sandbox.nexmo.com/v1/messages`, {
    method: "POST",
    body: JSON.stringify({
      from: Bun.env.VONAGE_WHATSAPP_NUMBER,
      to: req.body.from,
      message_type: "text",
      text: `You sent me: ${req.body.text}`,
      channel: "whatsapp",
    }),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${basicAuthToken}`,
    },
  });

  return res.json({ ok: true }, 200);
};
