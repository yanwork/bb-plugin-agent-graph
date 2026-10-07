import assert from "node:assert/strict";
import { test } from "node:test";
import { backgroundAgents, GraphBuilder } from "../server.ts";

function delegation(extra: Record<string, unknown>) {
  return {
    kind: "work",
    workKind: "delegation",
    id: "d1",
    description: "Sleep 60",
    background: true,
    childRows: [],
    output: "",
    ...extra,
  };
}

function subagent(row: Record<string, unknown>, threadRunning: boolean, backgroundLive: boolean) {
  const builder = new GraphBuilder();
  builder.addWork([row], "turn", "thr", threadRunning, backgroundLive);
  return builder.nodes.find((node) => node.kind === "subagent")!;
}

const handback = (message: string) => ({
  kind: "work",
  workKind: "tool",
  toolName: "SubagentHandback",
  toolArgs: { message },
  status: "completed",
});

test("between turns a launched background subagent runs while bb counts background agents", () => {
  const launched = delegation({ status: "completed", output: "started subagent 2699d2bb" });
  const running = subagent(launched, false, true);
  assert.equal(running.status, "running");
  assert.equal(running.output, null, "the launch receipt is not a report");
  assert.equal(subagent(launched, false, false).status, "done", "no background agents left: done");
});

test("a handed-back subagent is done even while other background agents run", () => {
  const node = subagent(delegation({ status: "completed", childRows: [handback("slept 30")] }), false, true);
  assert.equal(node.status, "done");
  assert.equal(node.output, "slept 30");
});

test("launch receipts are never shown as reports", () => {
  const receipt = subagent(delegation({ status: "completed", output: "Async agent launched successfully." }), false, false);
  assert.equal(receipt.output, null);
});

test("a background delegation closed with its own report still shows it", () => {
  assert.equal(subagent(delegation({ status: "completed", output: "final words" }), false, false).output, "final words");
});

test("background agent counts come from thread lists or a single thread", () => {
  const base = { id: "t", projectId: "p", title: null, titleFallback: null, status: "idle", parentThreadId: null, providerId: null, updatedAt: 0, createdAt: 0 };
  assert.equal(backgroundAgents({ ...base, activity: { activeBackgroundAgentCount: 2 } }), 2);
  assert.equal(backgroundAgents({ ...base, activeBackgroundAgentCount: 1 }), 1);
  assert.equal(backgroundAgents(base), 0);
});
