import { createAgent, type PollSnapshot } from "./agent-common.js";

const agent = createAgent("momentum");
let previous: PollSnapshot | undefined;

async function run() {
  try {
    previous = await agent.poll(previous);
  } catch (error) {
    console.error("[momentum] poll failed", error);
  }
}

await run();
if (previous) await run();
setInterval(run, 150_000);