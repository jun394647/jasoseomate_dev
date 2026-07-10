// 생성 엔진 (배포용): LLM_PROVIDER 환경변수로 백엔드 선택.
//  - "claude" (기본): 로컬 claude CLI (구독 기반, API 키 불필요)
//  - "glm":  Zhipu AI GLM API (GLM-4.7 Flash 등) — 서버 배포 환경용
// 다른 모듈은 전부 runClaude()만 호출하므로 이 파일만으로 백엔드가 바뀐다.

import { spawn } from "node:child_process";

export interface ClaudeRunResult {
  text: string;
  costUsd: number | null;
}

interface ClaudePrintJson {
  type: string;
  subtype: string;
  is_error: boolean;
  result: string;
  total_cost_usd?: number;
}

const LLM_TIMEOUT_MS = 120_000;

export function runClaude(userPrompt: string, systemPrompt: string): Promise<ClaudeRunResult> {
  if ((process.env.LLM_PROVIDER ?? "claude").toLowerCase() === "glm") {
    return runGlm(userPrompt, systemPrompt);
  }
  return runClaudeCli(userPrompt, systemPrompt);
}

// ───── GLM (Zhipu AI, OpenAI 호환 chat completions) ─────

interface GlmResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string; code?: string };
}

async function runGlm(userPrompt: string, systemPrompt: string): Promise<ClaudeRunResult> {
  const apiKey = process.env.GLM_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GLM_API_KEY가 설정되지 않았습니다. .env.local을 확인하세요. (bigmodel.cn 또는 z.ai에서 발급)"
    );
  }
  const baseUrl = (process.env.GLM_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4").replace(/\/$/, "");
  const model = process.env.GLM_MODEL ?? "glm-4.7-flash";

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 4096,
    }),
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
  });

  const data = (await res.json().catch(() => ({}))) as GlmResponse;
  if (!res.ok) {
    throw new Error(`GLM API 오류 (${res.status}): ${data.error?.message ?? "unknown"}`);
  }
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("GLM 응답이 비어 있습니다.");
  }
  // GLM Flash 계열은 무료/저가 정책 — 비용 추적은 생략
  return { text, costUsd: null };
}

// ───── claude CLI (로컬 구독) ─────

function runClaudeCli(userPrompt: string, systemPrompt: string): Promise<ClaudeRunResult> {
  return new Promise((resolve, reject) => {
    // NOTE: the system prompt is sent via stdin, not --system-prompt.
    // With shell:true on Windows the multi-line prompt gets mangled by
    // cmd.exe argument parsing (everything after the first newline is lost).
    const child = spawn(
      "claude",
      ["-p", "--output-format", "json", "--tools", "", "--no-session-persistence"],
      {
        cwd: process.cwd(),
        stdio: ["pipe", "pipe", "pipe"],
        shell: process.platform === "win32",
      }
    );

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("claude CLI 응답이 시간 초과되었습니다."));
    }, LLM_TIMEOUT_MS);

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`claude CLI 실행에 실패했습니다: ${err.message}`));
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`claude CLI가 오류로 종료되었습니다 (code ${code}): ${stderr}`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout) as ClaudePrintJson;
        if (parsed.is_error) {
          reject(new Error(`claude 생성 오류: ${parsed.result}`));
          return;
        }
        resolve({ text: parsed.result, costUsd: parsed.total_cost_usd ?? null });
      } catch {
        reject(new Error(`claude CLI 출력 파싱 실패: ${stdout.slice(0, 500)}`));
      }
    });

    child.stdin.write(`[시스템 지침 - 반드시 준수]\n${systemPrompt}\n\n${userPrompt}`);
    child.stdin.end();
  });
}
