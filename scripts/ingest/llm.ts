import { OLLAMA_URL, MODEL } from "./config";
import { startObservation } from "@langfuse/tracing";

interface OllamaResponse {
  message: { role: string; content: string; thinking?: string };
  prompt_eval_count?: number;
  eval_count?: number;
}

export async function checkOllama(): Promise<void> {
  try {
    const res = await fetch("http://localhost:11434/api/tags", {
      signal: AbortSignal.timeout(3_000),
    });
    if (!res.ok) throw new Error();
  } catch {
    console.error("Error: Ollama is not running. Start it with: ollama serve");
    console.error(`Then pull the model: ollama pull ${MODEL}`);
    process.exit(1);
  }
}

export async function llm(
  name: string,
  system: string,
  user: string,
  opts: { temperature: number; num_predict: number },
): Promise<string> {
  const generation = startObservation(
    name,
    {
      model: MODEL,
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      modelParameters: {
        temperature: opts.temperature,
        num_predict: opts.num_predict,
      },
    },
    { asType: "generation" },
  );

  try {
    const res = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(120_000),
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        options: {
          temperature: opts.temperature,
          num_predict: opts.num_predict,
        },
        think: false,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      const error = new Error(`Ollama request failed: ${res.status} ${body}`);
      generation.update({ level: "ERROR", statusMessage: error.message });
      generation.end();
      throw error;
    }
    const data = (await res.json()) as OllamaResponse;
    const output =
      data.message.content.trim() || data.message.thinking?.trim() || "";

    generation.update({
      output: { role: "assistant", content: output },
      usageDetails: {
        input: data.prompt_eval_count ?? 0,
        output: data.eval_count ?? 0,
      },
    });
    generation.end();

    return output;
  } catch (e) {
    generation.update({ level: "ERROR", statusMessage: String(e) });
    generation.end();
    throw e;
  }
}
