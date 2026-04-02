/**
 * CLI subcommands for context extraction.
 *
 * npx @crowdlisten/harness context          # Launch web UI
 * npx @crowdlisten/harness context <file>   # CLI-only processing
 * npx @crowdlisten/harness setup            # Configure LLM provider (handled in index.ts)
 */

import { runPipeline } from "./pipeline.js";
import { loadConfig, saveConfig } from "./store.js";
import { startContextServer } from "./server.js";
import type { ContextConfig } from "./types.js";
import * as readline from "readline";

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Interactive setup: configure LLM provider and API key.
 */
export async function runSetupContext(): Promise<void> {
  console.error("\n🔧 CrowdListen Context — LLM Provider Setup\n");

  const existing = loadConfig();
  if (existing) {
    console.error(
      `Current config: ${existing.provider} (${existing.model || "default model"})`
    );
  }

  const providerInput = await prompt(
    "Provider (openai / anthropic) [openai]: "
  );
  const provider = (providerInput || "openai") as ContextConfig["provider"];

  const apiKey = await prompt(`${provider === "openai" ? "OpenAI" : "Anthropic"} API key: `);
  if (!apiKey) {
    console.error("❌ API key required.");
    process.exit(1);
  }

  const modelInput = await prompt("Model (press Enter for default): ");

  const config: ContextConfig = {
    provider,
    apiKey,
    ...(modelInput ? { model: modelInput } : {}),
  };

  saveConfig(config);
  console.error(`\n✅ Saved to ~/.crowdlisten/config.json`);
  console.error(`   Provider: ${config.provider}`);
  console.error(`   Model: ${config.model || "default"}\n`);
}

/**
 * Process a file via CLI (no web UI).
 */
export async function runContextCLI(filePath: string): Promise<void> {
  const config = loadConfig();
  if (!config) {
    console.error(
      "No LLM provider configured. Run: npx @crowdlisten/harness setup"
    );
    process.exit(1);
  }

  console.error(`\n📄 Processing: ${filePath}`);
  console.error(`   Provider: ${config.provider} (${config.model || "default"})\n`);

  try {
    const result = await runPipeline({
      filePath,
      source: filePath,
      onProgress: ({ current, total, blocksFound }) => {
        console.error(
          `   Chunk ${current}/${total} — ${blocksFound} blocks found`
        );
      },
    });

    console.error(`\n🛡️  PII Redaction:`);
    if (result.totalRedactions > 0) {
      for (const [type, count] of Object.entries(result.redactionStats)) {
        console.error(`   ${type}: ${count} redacted`);
      }
    } else {
      console.error("   No PII detected");
    }

    console.error(`\n📦 Extracted ${result.blocks.length} context blocks:\n`);
    for (const block of result.blocks) {
      console.error(`   [${block.type}] ${block.title}`);
      console.error(`   ${block.content}\n`);
    }

    if (result.skills.length > 0) {
      console.error(`🎯 Recommended Skills:\n`);
      for (const skill of result.skills) {
        console.error(
          `   ${skill.name} (${Math.round(skill.score * 100)}% match)`
        );
        console.error(`   ${skill.description}\n`);
      }
    }

    // Output JSON to stdout for piping
    process.stdout.write(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(
      `\n❌ ${err instanceof Error ? err.message : String(err)}`
    );
    process.exit(1);
  }
}

/**
 * Launch the web UI server.
 */
export async function runContextWeb(): Promise<void> {
  const config = loadConfig();
  if (!config) {
    console.error(
      "⚠️  No LLM provider configured. You can configure it in the web UI or run: npx @crowdlisten/harness setup\n"
    );
  }

  await startContextServer();
}
