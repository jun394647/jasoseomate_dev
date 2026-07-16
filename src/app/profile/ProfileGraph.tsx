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
import type { ProfileGraphNode } from "@/app/api/profile/graph/route";
import { getSnapshot, getServerSnapshot, subscribe } from "@/lib/themeStore";

// 검증된 카테고리 팔레트(파랑/초록/마젠타/노랑) + "기타"는 중립 회색으로 처리.
const CATEGORY_COLOR: Record<ProfileCategory, { light: string; dark: string }> = {
  info: { light: "#2a78d6", dark: "#3987e5" },
  history: { light: "#008300", dark: "#008300" },
  career: { light: "#e87ba4", dark: "#d55181" },
  experience: { light: "#eda100", dark: "#c98500" },
  etc: { light: "#898781", dark: "#898781" },
};

const CATEGORY_ORDER: ProfileCategory[] = ["info", "history", "career", "experience", "etc"];
const ROOT_ID = "__root__";

interface HubData extends Record<string, unknown> {
  category: ProfileCategory;
  count: number;
  theme: "light" | "dark";
}

interface LeafData extends Record<string, unknown> {
  label: string;
  category: ProfileCategory;
  theme: "light" | "dark";
}

// 지식그래프의 중심 — "내 정보"에서 카테고리들이 가지처럼 뻗어나간다.
function RootNode() {
  return (
    <div
      className="rounded-full bg-[#0b0b0b] dark:bg-white text-white dark:text-[#0b0b0b] px-4 py-2.5 shadow-md flex items-center justify-center"
      style={{ width: 96, height: 96 }}
    >
      <Handle type="source" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} id="b" />
      <p className="text-xs font-semibold text-center leading-tight">내 정보</p>
    </div>
  );
}

// 카테고리 허브 — 굵고 색이 채워져 있어 항목 노드와 한눈에 구분된다.
function HubNode({ data }: NodeProps<Node<HubData>>) {
  const color = CATEGORY_COLOR[data.category][data.theme];
  return (
    <div
      className="rounded-xl px-3.5 py-2.5 shadow-sm flex flex-col items-center justify-center text-center"
      style={{ width: 132, backgroundColor: color, color: "#fff" }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <p className="text-[12px] font-semibold">{PROFILE_CATEGORY_LABELS[data.category]}</p>
      <p className="text-[10px] opacity-85 mt-0.5">{data.count}개</p>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}

// 항목(leaf) — 옅은 테두리 + 카테고리 색 포인트만 남겨 허브보다 가볍게 보이도록 한다.
function LeafNode({ data }: NodeProps<Node<LeafData>>) {
  const color = CATEGORY_COLOR[data.category][data.theme];
  return (
    <div
      className="rounded-lg border bg-white dark:bg-[#1a1a19] px-3 py-2 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer"
      style={{ borderColor: `${color}55`, borderLeftColor: color, borderLeftWidth: 3, width: 152 }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <p className="text-[11px] font-medium text-[#0b0b0b] dark:text-white truncate">{data.label}</p>
    </div>
  );
}

const nodeTypes = { root: RootNode, hub: HubNode, leaf: LeafNode };

// 항목 카드 폭(152px) + 여백을 기준으로, 한 카테고리 안 항목들이 서로 겹치지 않을
// 최소 반지름을 원의 현(chord) 길이 공식으로 계산한다: neededR = (W/2) / sin(π/n).
const NODE_SPACING = 172;

// 허브 노드(폭 132) 자체와도 겹치지 않아야 하므로, 항목이 1~2개뿐이라
// 서로 간의 간격 계산값이 작더라도 허브 바깥으로 확실히 벗어날 최소
// 반지름(허브 반폭 + 항목 반폭 + 여백)을 바닥값으로 둔다.
const MIN_LEAF_RADIUS = 175;

function subRadiusFor(count: number): number {
  if (count <= 1) return MIN_LEAF_RADIUS;
  const angleStep = (2 * Math.PI) / count;
  return Math.max(NODE_SPACING / 2 / Math.sin(angleStep / 2), MIN_LEAF_RADIUS);
}

// 중심(내 정보) → 카테고리 허브 → 항목 순서의 트리로 배치한다.
// 카테고리 허브는 중심을 둘러싼 원 위에, 각 카테고리의 항목은 그 허브를 둘러싼
// 작은 원 위에 놓여 "가지가 뻗어나가는" 모양이 된다. 유사도 기반 교차 연결이
// 없으니 겹침 계산도 카테고리 단위로만 하면 충분하다.
function layoutNodes(
  nodes: ProfileGraphNode[],
  theme: "light" | "dark"
): { flowNodes: Node[]; flowEdges: Edge[] } {
  const byCategory = new Map<ProfileCategory, ProfileGraphNode[]>();
  for (const n of nodes) {
    const list = byCategory.get(n.category) ?? [];
    list.push(n);
    byCategory.set(n.category, list);
  }
  const cats = CATEGORY_ORDER.filter((c) => byCategory.has(c));

  const maxSubRadius = Math.max(...cats.map((c) => subRadiusFor(byCategory.get(c)!.length)), 0);
  const hubRadius = cats.length > 1 ? Math.max(maxSubRadius * 1.6 + 160, 220) : 0;
  const centerX = hubRadius + maxSubRadius + 220;
  const centerY = hubRadius + maxSubRadius + 180;

  // fitView가 첫 렌더에서 노드 크기를 정확히 재기 전에도 올바른 경계를 계산할 수
  // 있도록, 실제 카드 크기를 width/height로 명시해준다(비워두면 아직 측정 전인
  // 노드가 경계 계산에서 누락돼 그래프 바깥쪽 항목이 잘려 보일 수 있다).
  const ROOT_SIZE = 96;
  const HUB_W = 132;
  const HUB_H = 64;
  const LEAF_W = 152;
  const LEAF_H = 40;

  const flowNodes: Node[] = [
    {
      id: ROOT_ID,
      type: "root",
      position: { x: centerX - ROOT_SIZE / 2, y: centerY - ROOT_SIZE / 2 },
      width: ROOT_SIZE,
      height: ROOT_SIZE,
      data: {},
      draggable: false,
    },
  ];
  const flowEdges: Edge[] = [];

  cats.forEach((cat, ci) => {
    const angle = (2 * Math.PI * ci) / cats.length - Math.PI / 2;
    const hx = centerX + hubRadius * Math.cos(angle);
    const hy = centerY + hubRadius * Math.sin(angle);
    const hubId = `hub-${cat}`;
    const color = CATEGORY_COLOR[cat][theme];
    const items = byCategory.get(cat)!;

    flowNodes.push({
      id: hubId,
      type: "hub",
      position: { x: hx - HUB_W / 2, y: hy - HUB_H / 2 },
      width: HUB_W,
      height: HUB_H,
      data: { category: cat, count: items.length, theme },
      draggable: false,
    });
    flowEdges.push({
      id: `${ROOT_ID}-${hubId}`,
      source: ROOT_ID,
      target: hubId,
      style: { stroke: color, strokeWidth: 2.5 },
    });

    const subRadius = subRadiusFor(items.length);
    items.forEach((item, i) => {
      const subAngle = (2 * Math.PI * i) / items.length - Math.PI / 2;
      const ix = hx + subRadius * Math.cos(subAngle);
      const iy = hy + subRadius * Math.sin(subAngle);
      flowNodes.push({
        id: item.id,
        type: "leaf",
        position: { x: ix - LEAF_W / 2, y: iy - LEAF_H / 2 },
        width: LEAF_W,
        height: LEAF_H,
        data: { label: item.title, category: item.category, theme },
        draggable: false,
      });
      flowEdges.push({
        id: `${hubId}-${item.id}`,
        source: hubId,
        target: item.id,
        style: { stroke: color, strokeWidth: 1.25, opacity: 0.55 },
      });
    });
  });

  return { flowNodes, flowEdges };
}

export default function ProfileGraph() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [nodesData, setNodesData] = useState<ProfileGraphNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ProfileGraphNode | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile/graph")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setNodesData(d.nodes);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const { flowNodes, flowEdges } = useMemo(() => layoutNodes(nodesData, theme), [nodesData, theme]);

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
            내 정보가 카테고리별로 어떻게 나뉘어 있는지 한눈에 보여줘요. 항목을 클릭하면 전체 내용을 볼 수 있어요.
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
          key={flowNodes.length}
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          colorMode={theme}
          onNodeClick={(_, node) => {
            const found = nodesData.find((n) => n.id === node.id);
            if (found) setSelected(found);
          }}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.1}
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
