import { createAgent, type PollSnapshot } from "./agent-common.js";

const agent = createAgent("contrarian");
let previous: PollSnapshot | undefined;

async function run() {
  try {
    previous = await agent.poll(previous);
  } catch (error) {
    console.error("[contrarian] poll failed", error);
  }
}

await run();
if (previous) await run();
setInterval(run, 150_000);