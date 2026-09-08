import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type EchoAddresses = {
  mUSDC: string;
  mAAPL: string;
  mNVDA: string;
  pool: string;
  momentumVault: string;
  contrarianVault: string;
};

const addressFile = process.env.ECHO_ADDRESSES_FILE ?? resolve(process.cwd(), "agents/addresses.json");

function rootEnv(name: string): string | undefined {
  try {
    const line = readFileSync(resolve(process.cwd(), ".env"), "utf8")
      .split("\n")
      .find((entry) => entry.startsWith(`${name}=`));
    return line?.slice(name.length + 1).trim().replace(/^['"]|['"]$/g, "");
  } catch {
    return undefined;
  }
}

export function loadAddresses(): EchoAddresses {
  try {
    return JSON.parse(readFileSync(addressFile, "utf8")) as EchoAddresses;
  } catch {
    throw new Error(`Missing ${addressFile}. Deploy Echo with Ignition and copy its deployed addresses into this file.`);
  }
}

export const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL ?? process.env.RPC_URL ?? rootEnv("BASE_SEPOLIA_RPC_URL");
export const privateKey = process.env.PRIVATE_KEY ?? rootEnv("PRIVATE_KEY");

if (!rpcUrl || !privateKey) {
  throw new Error("Set BASE_SEPOLIA_RPC_URL (or RPC_URL) and PRIVATE_KEY before running an agent.");
}