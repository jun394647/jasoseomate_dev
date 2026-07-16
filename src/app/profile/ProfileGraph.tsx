"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Card } from "@/components/ui";
import Modal from "@/components/Modal";
import { PROFILE_CATEGORY_LABELS } from "@/lib/types";
import type { ProfileCategory } from "@/lib/types";
import type { ProfileGraphNode, ProfileGraphEdge } from "@/app/api/profile/graph/route";

const CATEGORY_COLORS: Record<ProfileCategory, string> = {
  info: "#898781",
  history: "#7c5cbf",
  career: "#2a78d6",
  experience: "#1f9d55",
  etc: "#d08c2a",
};

const CATEGORY_ORDER: ProfileCategory[] = ["info", "history", "career", "experience", "etc"];

function layoutNodes(nodes: ProfileGraphNode[]): Node[] {
  const byCategory = new Map<ProfileCategory, ProfileGraphNode[]>();
  for (const n of nodes) {
    const list = byCategory.get(n.category) ?? [];
    list.push(n);
    byCategory.set(n.category, list);
  }

  const COL_WIDTH = 220;
  const ROW_HEIGHT = 90;
  const result: Node[] = [];

  CATEGORY_ORDER.forEach((cat, colIndex) => {
    const items = byCategory.get(cat) ?? [];
    items.forEach((item, rowIndex) => {
      result.push({
        id: item.id,
        position: { x: colIndex * COL_WIDTH, y: rowIndex * ROW_HEIGHT },
        data: { label: item.title },
        style: {
          background: `${CATEGORY_COLORS[cat]}1a`,
          border: `1.5px solid ${CATEGORY_COLORS[cat]}`,
          borderRadius: 10,
          padding: "6px 10px",
          fontSize: 12,
          width: 180,
        },
      });
    });
  });

  return result;
}

export default function ProfileGraph() {
  const [nodesData, setNodesData] = useState<ProfileGraphNode[]>([]);
  const [edgesData, setEdgesData] = useState<ProfileGraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ProfileGraphNode | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile/graph")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) {
          setNodesData(d.nodes);
          setEdgesData(d.edges);
        }
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const nodes = useMemo(() => layoutNodes(nodesData), [nodesData]);
  const edges: Edge[] = useMemo(
    () =>
      edgesData.map((e) => ({
        id: `${e.source}-${e.target}`,
        source: e.source,
        target: e.target,
        style: { stroke: "#898781", strokeWidth: 1, opacity: 0.4 + e.weight * 0.4 },
      })),
    [edgesData]
  );

  if (loading || nodesData.length === 0) return null;

  return (
    <Card className="p-5 mt-6">
      <p className="text-sm font-medium text-[#0b0b0b] dark:text-white mb-1">경험/경력 지식그래프</p>
      <p className="text-xs text-[#898781] mb-3">
        내용이 비슷한 항목끼리 선으로 연결됩니다. 노드를 클릭하면 전체 내용을 볼 수 있어요.
      </p>
      <div style={{ height: 420 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodeClick={(_, node) => {
            const found = nodesData.find((n) => n.id === node.id);
            if (found) setSelected(found);
          }}
          fitView
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
        >
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      {selected && (
        <Modal title={selected.title} onClose={() => setSelected(null)}>
          <span className="inline-block text-[10px] rounded-full px-2 py-0.5 mb-2 bg-[#2a78d6]/10 text-[#2a78d6] dark:text-[#3987e5] font-medium">
            {PROFILE_CATEGORY_LABELS[selected.category]}
          </span>
          <p className="text-sm text-[#52514e] dark:text-[#c3c2b7] whitespace-pre-wrap">
            {selected.content}
          </p>
        </Modal>
      )}
    </Card>
  );
}
