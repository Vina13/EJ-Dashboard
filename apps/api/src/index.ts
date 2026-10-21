import { createApp } from "./app";

const port = Number(process.env.PORT ?? 3000);
const authSecret = process.env.AUTH_SECRET;

if (!authSecret) {
  console.error("AUTH_SECRET is not set. Copy .env.example to .env and set it.");
  process.exit(1);
}

createApp({ authSecret }).listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
