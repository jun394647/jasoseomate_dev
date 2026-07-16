"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Card } from "@/components/ui";
import Modal from "@/components/Modal";
import { PROFILE_CATEGORY_LABELS } from "@/lib/types";
import type { ProfileCategory } from "@/lib/types";
import type { ProfileGraphNode, ProfileGraphEdge } from "@/app/api/profile/graph/route";
import { getSnapshot, getServerSnapshot, subscribe } from "@/lib/themeStore";

// 검증된 카테고리 팔레트(파랑/초록/마젠타/노랑) + "기타"는 중립 회색으로 처리.
// 5개 색상은 all-pairs 대비에서 CVD 안전 기준을 못 넘겨(스킬 검증 결과),
// "기타" 카테고리를 색상 경쟁에서 빼고 무채색으로 돌리는 편이 원 뜻("그 외")과도 맞다.
const CATEGORY_COLOR: Record<ProfileCategory, { light: string; dark: string }> = {
  info: { light: "#2a78d6", dark: "#3987e5" },
  history: { light: "#008300", dark: "#008300" },
  career: { light: "#e87ba4", dark: "#d55181" },
  experience: { light: "#eda100", dark: "#c98500" },
  etc: { light: "#898781", dark: "#898781" },
};

const CATEGORY_ORDER: ProfileCategory[] = ["info", "history", "career", "experience", "etc"];

interface NodeData extends Record<string, unknown> {
  label: string;
  category: ProfileCategory;
  theme: "light" | "dark";
}

function CategoryNode({ data }: NodeProps<Node<NodeData>>) {
  const color = CATEGORY_COLOR[data.category][data.theme];
  return (
    <div
      className="rounded-lg border bg-white dark:bg-[#1a1a19] px-3 py-2 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer"
      style={{ borderColor: color, borderLeftWidth: 3, width: 168 }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <p className="text-[11px] font-medium text-[#0b0b0b] dark:text-white truncate">
        {data.label}
      </p>
      <p className="text-[10px] mt-0.5" style={{ color }}>
        {PROFILE_CATEGORY_LABELS[data.category]}
      </p>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}

const nodeTypes = { category: CategoryNode };

// 노드 카드 폭(168px) + 여백을 기준으로, 클러스터 안 노드들이 서로 겹치지 않을
// 최소 반지름을 원의 현(chord) 길이 공식으로 계산한다: neededR = (W/2) / sin(π/n).
const NODE_SPACING = 190;

function subRadiusFor(count: number): number {
  if (count <= 1) return 0;
  const angleStep = (2 * Math.PI) / count;
  return Math.max(NODE_SPACING / 2 / Math.sin(angleStep / 2), 70);
}

// 카테고리별로 클러스터를 원형으로 배치하고, 클러스터 안에서도 노드를 작은 원으로 펼친다 —
// 컬럼으로 늘어놓는 것보다 "그래프"답게 보이면서, 별도 물리 시뮬레이션 라이브러리 없이도 겹침을 막는다.
function layoutNodes(nodes: ProfileGraphNode[], theme: "light" | "dark"): Node<NodeData>[] {
  const byCategory = new Map<ProfileCategory, ProfileGraphNode[]>();
  for (const n of nodes) {
    const list = byCategory.get(n.category) ?? [];
    list.push(n);
    byCategory.set(n.category, list);
  }
  const cats = CATEGORY_ORDER.filter((c) => byCategory.has(c));

  // 클러스터 중심 간 거리는 이웃 클러스터의 (자기 반지름 + 상대 반지름 + 여유)보다 커야 겹치지 않는다.
  const maxSubRadius = Math.max(...cats.map((c) => subRadiusFor(byCategory.get(c)!.length)), 0);
  const clusterRadius = cats.length > 1 ? Math.max(maxSubRadius * 2 + 140, 260) : 0;
  const centerX = clusterRadius + 200;
  const centerY = clusterRadius + 140;
  const result: Node<NodeData>[] = [];

  cats.forEach((cat, ci) => {
    const angle = (2 * Math.PI * ci) / cats.length - Math.PI / 2;
    const cx = centerX + clusterRadius * Math.cos(angle);
    const cy = centerY + clusterRadius * Math.sin(angle);
    const items = byCategory.get(cat)!;
    const subRadius = subRadiusFor(items.length);

    items.forEach((item, i) => {
      const subAngle = (2 * Math.PI * i) / items.length - Math.PI / 2;
      result.push({
        id: item.id,
        type: "category",
        position: {
          x: cx + subRadius * Math.cos(subAngle) - 84,
          y: cy + subRadius * Math.sin(subAngle) - 20,
        },
        data: { label: item.title, category: item.category, theme },
      });
    });
  });

  return result;
}

export default function ProfileGraph() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
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

  const nodes = useMemo(() => layoutNodes(nodesData, theme), [nodesData, theme]);
  const edges: Edge[] = useMemo(
    () =>
      edgesData.map((e) => ({
        id: `${e.source}-${e.target}`,
        source: e.source,
        target: e.target,
        style: { stroke: "#898781", strokeWidth: 1.5, opacity: 0.35 + e.weight * 0.35 },
      })),
    [edgesData]
  );

  const categoriesPresent = useMemo(
    () => CATEGORY_ORDER.filter((c) => nodesData.some((n) => n.category === c)),
    [nodesData]
  );

  if (loading || nodesData.length === 0) return null;

  return (
    <Card className="p-5 mt-6">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div>
          <p className="text-sm font-medium text-[#0b0b0b] dark:text-white">경험/경력 지식그래프</p>
          <p className="text-xs text-[#898781] mt-0.5">
            내용이 비슷한 항목끼리 선으로 연결됩니다. 노드를 클릭하면 전체 내용을 볼 수 있어요.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {categoriesPresent.map((c) => (
            <span key={c} className="inline-flex items-center gap-1.5 text-[11px] text-[#52514e] dark:text-[#c3c2b7]">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: CATEGORY_COLOR[c][theme] }}
              />
              {PROFILE_CATEGORY_LABELS[c]}
            </span>
          ))}
        </div>
      </div>
      <div style={{ height: 440 }} className="rounded-lg overflow-hidden border border-[rgba(11,11,11,0.08)] dark:border-[rgba(255,255,255,0.08)]">
        <ReactFlow
          // 노드가 비동기로 로드되므로, 최초 마운트 때의 fitView는 빈 화면 기준으로 끝나버린다.
          // 노드 개수가 바뀔 때 다시 마운트시켜 fitView가 실제 데이터로 재계산되게 한다.
          key={nodes.length}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          colorMode={theme}
          onNodeClick={(_, node) => {
            const found = nodesData.find((n) => n.id === node.id);
            if (found) setSelected(found);
          }}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
        >
          <Background gap={20} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      {selected && (
        <Modal title={selected.title} onClose={() => setSelected(null)}>
          <span
            className="inline-block text-[10px] rounded-full px-2 py-0.5 mb-2 font-medium"
            style={{
              backgroundColor: `${CATEGORY_COLOR[selected.category][theme]}1a`,
              color: CATEGORY_COLOR[selected.category][theme],
            }}
          >
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
