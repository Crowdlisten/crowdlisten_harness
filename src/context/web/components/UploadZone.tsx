import React, { useState, useEffect } from "react";

interface SkillPackInfo {
  id: string;
  name: string;
  description: string;
  toolCount: number;
  status: "active" | "available";
  isVirtual: boolean;
}

interface Props {
  onStartImport: () => void;
  disabled: boolean;
}

export default function UploadZone({ onStartImport, disabled }: Props) {
  const [packs, setPacks] = useState<SkillPackInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [blockCount, setBlockCount] = useState(0);

  useEffect(() => {
    Promise.all([
      fetch("/api/packs").then(r => r.json()),
      fetch("/api/blocks").then(r => r.json()),
    ])
      .then(([packData, blockData]) => {
        setPacks(packData.packs || []);
        setBlockCount(blockData.blocks?.length || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const activePacks = packs.filter(p => p.status === "active" && !p.isVirtual);
  const availablePacks = packs.filter(p => p.status === "available" && !p.isVirtual);
  const totalTools = activePacks.reduce((sum, p) => sum + p.toolCount, 0);

  async function togglePack(packId: string, isActive: boolean) {
    const endpoint = isActive ? "/api/state/deactivate" : "/api/state/activate";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pack_id: packId }),
    });
    if (res.ok) {
      setPacks(prev =>
        prev.map(p =>
          p.id === packId
            ? { ...p, status: isActive ? "available" as const : "active" as const }
            : p
        )
      );
    }
  }

  return (
    <div className="space-y-4">
      {/* Overview stats */}
      <div
        className="glass-card flex items-center justify-between"
        style={{ padding: "18px 24px" }}
      >
        <div className="flex items-start gap-3 min-w-0">
          <div
            className="w-9 h-9 flex items-center justify-center text-base shrink-0 mt-0.5"
            style={{
              background: "rgba(111, 164, 175, 0.12)",
              borderRadius: "var(--radius-s)",
              color: "var(--brand-teal)",
            }}
          >
            &#9889;
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm" style={{ color: "var(--cl-fg)" }}>
              {loading ? "Loading..." : `${activePacks.length} active skill packs`}
            </p>
            <p className="text-sm mt-0.5" style={{ color: "var(--cl-fg-muted)" }}>
              {totalTools} tools available &middot; {blockCount} context blocks saved &middot;{" "}
              {availablePacks.length} more packs to activate
            </p>
          </div>
        </div>
        <button
          onClick={onStartImport}
          disabled={disabled}
          className="btn-secondary shrink-0 ml-4"
          style={{ opacity: disabled ? 0.5 : 1 }}
        >
          Import Context
        </button>
      </div>

      {/* Active packs */}
      {!loading && (
        <div>
          <h3
            className="text-sm font-medium mb-2"
            style={{ color: "var(--cl-fg-muted)" }}
          >
            Active Packs
          </h3>
          <div className="flex flex-wrap gap-2">
            {activePacks.map(pack => (
              <button
                key={pack.id}
                onClick={() => togglePack(pack.id, true)}
                className="pill"
                style={{
                  cursor: "pointer",
                  background: "rgba(111, 164, 175, 0.15)",
                  border: "1px solid var(--brand-teal)",
                  color: "var(--brand-teal)",
                  fontSize: "11px",
                  padding: "4px 12px",
                }}
                title={`${pack.description} (${pack.toolCount} tools) — click to deactivate`}
              >
                {pack.name} ({pack.toolCount})
              </button>
            ))}
            {activePacks.length === 0 && (
              <span className="text-xs" style={{ color: "var(--cl-fg-muted)" }}>
                Only core tools active — activate packs below
              </span>
            )}
          </div>

          {availablePacks.length > 0 && (
            <>
              <h3
                className="text-sm font-medium mb-2 mt-4"
                style={{ color: "var(--cl-fg-muted)" }}
              >
                Available Packs
              </h3>
              <div className="flex flex-wrap gap-2">
                {availablePacks.map(pack => (
                  <button
                    key={pack.id}
                    onClick={() => togglePack(pack.id, false)}
                    className="pill"
                    style={{
                      cursor: "pointer",
                      background: "var(--cl-bg-secondary)",
                      border: "1px solid var(--cl-border-light)",
                      color: "var(--cl-fg)",
                      fontSize: "11px",
                      padding: "4px 12px",
                    }}
                    title={`${pack.description} (${pack.toolCount} tools) — click to activate`}
                  >
                    {pack.name} ({pack.toolCount})
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
