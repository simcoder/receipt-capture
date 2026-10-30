import { spawnSync } from "node:child_process";

const steps = [
  { command: "npm", args: ["test"] },
  { command: "npm", args: ["run", "typecheck"] },
  { command: "npm", args: ["test", "--prefix", "infra"] },
];

let passed = 0;
for (const step of steps) {
  const result = spawnSync(step.command, step.args, { stdio: "inherit" });
  if (result.status !== 0) {
    console.log(`${passed} of ${steps.length} commands passed`);
    process.exit(result.status ?? 1);
  }
  passed += 1;
}
console.log(`${passed} of ${steps.length} commands passed`);
