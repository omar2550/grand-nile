import "dotenv/config";
import express from "express";
import cors from "cors";
import cron from "node-cron";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { authenticate } from "./auth.js";
import core from "./routes.js";
import more from "./routes2.js";
import pub from "./public.js";
import { runBackup } from "./backup.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use("/api/public", pub);
app.use("/api", core); // sign-in lives here, then everything after is protected
app.use("/api", more);
const dist = path.resolve("../client/dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (_, res) => res.sendFile(path.join(dist, "index.html")));
}

await mongoose.connect(
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/grand_nile",
);
cron.schedule(process.env.BACKUP_CRON || "0 3 * * *", () =>
  runBackup("auto")
    .then((n) => console.log("Backup saved", n))
    .catch((e) => console.error("Backup failed", e.message)),
);

const port = process.env.PORT || 4000;
app.listen(port, "0.0.0.0", () =>
  console.log(`Hotel API running on port ${port}`),
);
