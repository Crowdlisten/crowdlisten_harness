import { describe, it, expect } from "vitest";
import * as os from "os";
import * as path from "path";
import { getAgentConfigs, MCP_ENTRY } from "../../src/tools.js";

describe("getAgentConfigs", () => {
  it("returns configurations for all supported agents", () => {
    const configs = getAgentConfigs();
    const names = configs.map((c) => c.name);

    expect(names).toContain("Claude Code");
    expect(names).toContain("Cursor");
    expect(names).toContain("Cursor (project)");
    expect(names).toContain("Gemini CLI");
    expect(names).toContain("Codex");
    expect(names).toContain("Amp");
  });

  it("returns exactly 6 agent configurations", () => {
    const configs = getAgentConfigs();
    expect(configs).toHaveLength(6);
  });

  it("each config has name, configPath, and mcpKey", () => {
    const configs = getAgentConfigs();
    for (const config of configs) {
      expect(config.name).toBeTruthy();
      expect(config.configPath).toBeTruthy();
      expect(config.mcpKey).toBeTruthy();
    }
  });

  it("Claude Code config path is ~/.claude.json", () => {
    const configs = getAgentConfigs();
    const claude = configs.find((c) => c.name === "Claude Code")!;
    expect(claude.configPath).toBe(path.join(os.homedir(), ".claude.json"));
    expect(claude.mcpKey).toBe("mcpServers");
  });

  it("Codex uses mcp_servers key (underscore)", () => {
    const configs = getAgentConfigs();
    const codex = configs.find((c) => c.name === "Codex")!;
    expect(codex.mcpKey).toBe("mcp_servers");
  });

  it("Amp uses dotted mcpKey path", () => {
    const configs = getAgentConfigs();
    const amp = configs.find((c) => c.name === "Amp")!;
    expect(amp.mcpKey).toBe("amp.mcpServers");
  });
});

describe("MCP_ENTRY constant", () => {
  it("has command 'npx'", () => {
    expect(MCP_ENTRY.command).toBe("npx");
  });

  it("has args with -y flag and package name", () => {
    expect(MCP_ENTRY.args).toContain("-y");
    expect(MCP_ENTRY.args).toContain("@crowdlisten/planner");
  });

  it("has exactly 2 args", () => {
    expect(MCP_ENTRY.args).toHaveLength(2);
  });
});
