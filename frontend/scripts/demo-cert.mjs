// Creates a self-signed HTTPS certificate for the demo dev server (npm run
// dev:demo). Browsers only allow the microphone on localhost or over HTTPS, so
// a second device joining over the network needs HTTPS. The certificate
// covers localhost and this machine's current LAN addresses, and is
// regenerated on every run so a new network address is picked up. Other
// devices will show a certificate warning once; accept it to continue.
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { networkInterfaces } from "node:os";

const lan = Object.values(networkInterfaces())
  .flat()
  .filter((net) => net && net.family === "IPv4" && !net.internal)
  .map((net) => net.address);
const names = ["DNS:localhost", "IP:127.0.0.1", ...lan.map((ip) => `IP:${ip}`)];

mkdirSync("certificates", { recursive: true });
execFileSync(
  "openssl",
  [
    "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "30",
    "-keyout", "certificates/demo-key.pem",
    "-out", "certificates/demo-cert.pem",
    "-subj", "/CN=emergency-call-demo",
    "-addext", `subjectAltName=${names.join(",")}`,
  ],
  { stdio: "pipe" }, // openssl prints progress noise; errors still throw
);

console.log("Demo HTTPS certificate created. Open the app on other devices at:");
for (const ip of lan) console.log(`  https://${ip}:3000/?role=caller`);
