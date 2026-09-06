/**
 * AI tutor: the EASI platform's grounded gpt-oss tutor, reached through the
 * same /api/ask/stream the Science Museum halls use. The studio is a static
 * site served on the EASI origin, so the learner's session token in
 * sessionStorage authorises the call. Outside EASI the tutor reports that it
 * needs a signed-in EASI session.
 */
const TOKEN_KEY = "rag_platform_api_token";

export type TutorState =
  | { status: "idle" }
  | { status: "streaming"; text: string }
  | { status: "done"; text: string; sources?: string[] }
  | { status: "signin" }
  | { status: "error"; message: string };

export function sessionToken() {
  try {
    return window.sessionStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function tutorAvailable() {
  return Boolean(sessionToken());
}

type Handlers = {
  onDelta: (text: string) => void;
};

export async function askTutor(question: string, theme: string, { onDelta }: Handlers): Promise<TutorState> {
  const token = sessionToken();
  if (!token) return { status: "signin" };

  let response: Response;
  try {
    response = await fetch(new URL("/api/ask/stream", window.location.origin).toString(), {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        moduleId: "academics-students",
        question,
        history: [],
        theme: theme.slice(0, 120),
        tutorMode: "explain",
      }),
    });
  } catch {
    return { status: "error", message: "The EASI tutor could not be reached." };
  }
  if (response.status === 401 || response.status === 403) return { status: "signin" };
  if (!response.ok || !response.body) return { status: "error", message: `The EASI tutor answered ${response.status}.` };

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let streamed = "";
  let answer = "";
  const sources: string[] = [];

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";
    for (const block of blocks) {
      let event = "";
      let data = "";
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (!data) continue;
      let payload: { text?: string; answer?: string; passages?: Array<{ title?: string; source?: string }> } | null = null;
      try {
        payload = JSON.parse(data);
      } catch {
        continue;
      }
      if (event === "delta" && payload?.text) {
        streamed += payload.text;
        onDelta(streamed);
      } else if (event === "passages" && Array.isArray(payload?.passages)) {
        payload.passages.forEach((p) => {
          const label = p.title || p.source;
          if (label && !sources.includes(label)) sources.push(label);
        });
      } else if (event === "done") {
        answer = payload?.answer || streamed;
      }
    }
  }
  const text = (answer || streamed).trim();
  if (!text) return { status: "error", message: "The tutor returned no answer." };
  return { status: "done", text, sources: sources.slice(0, 4) };
}
