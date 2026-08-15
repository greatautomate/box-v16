import {
  Agent,
  ClaudeCode,
  OpenAICodex,
  OpenCodeModel,
  OpenRouterModel,
  CursorModel,
} from "@upstash/box";

export {
  Agent,
  ClaudeCode,
  OpenAICodex,
  OpenCodeModel,
  OpenRouterModel,
  CursorModel,
};

export interface ModelOption {
  value: string;
  label: string;
}

export interface ModelGroup {
  label: string;
  options: ModelOption[];
}

/**
 * Model options grouped by agent harness — mirrors packages/cli/src/models.ts.
 * Options are ordered newest-first; the keyboard paginates them and marks the
 * entries in RECOMMENDED_BY_AGENT with a ⭐.
 */
export const MODEL_OPTIONS_BY_AGENT: Record<string, ModelGroup[]> = {
  [Agent.ClaudeCode]: [
    {
      label: "Anthropic",
      options: [
        { value: ClaudeCode.Fable_5, label: "Claude Fable 5" },
        { value: ClaudeCode.Opus_5, label: "Claude Opus 5" },
        { value: ClaudeCode.Opus_4_8, label: "Claude Opus 4.8" },
        { value: ClaudeCode.Opus_4_7, label: "Claude Opus 4.7" },
        { value: ClaudeCode.Opus_4_6, label: "Claude Opus 4.6" },
        { value: ClaudeCode.Opus_4_5, label: "Claude Opus 4.5" },
        { value: ClaudeCode.Sonnet_5, label: "Claude Sonnet 5" },
        { value: ClaudeCode.Sonnet_4_6, label: "Claude Sonnet 4.6" },
        { value: ClaudeCode.Sonnet_4_5, label: "Claude Sonnet 4.5" },
        { value: ClaudeCode.Sonnet_4, label: "Claude Sonnet 4" },
        { value: ClaudeCode.Haiku_4_5, label: "Claude Haiku 4.5" },
      ],
    },
  ],
  [Agent.Codex]: [
    {
      label: "OpenAI",
      options: [
        { value: OpenAICodex.GPT_5_5, label: "GPT-5.5" },
        { value: OpenAICodex.GPT_5_4, label: "GPT-5.4" },
        { value: OpenAICodex.GPT_5_4_Mini, label: "GPT-5.4 Mini" },
        { value: OpenAICodex.GPT_5_3_Codex, label: "GPT-5.3 Codex" },
        {
          value: OpenAICodex.GPT_5_3_Codex_Spark,
          label: "GPT-5.3 Codex Spark",
        },
        { value: OpenAICodex.GPT_5_2_Codex, label: "GPT-5.2 Codex" },
        { value: OpenAICodex.GPT_5_1_Codex_Max, label: "GPT-5.1 Codex Max" },
        { value: OpenAICodex.GPT_5_1_Codex_Mini, label: "GPT-5.1 Codex Mini" },
      ],
    },
  ],
  [Agent.OpenCode]: [
    {
      label: "Anthropic",
      options: [
        { value: OpenCodeModel.Claude_Fable_5, label: "Claude Fable 5" },
        { value: OpenCodeModel.Claude_Opus_5, label: "Claude Opus 5" },
        { value: OpenCodeModel.Claude_Opus_4_8, label: "Claude Opus 4.8" },
        { value: OpenCodeModel.Claude_Opus_4_7, label: "Claude Opus 4.7" },
        { value: OpenCodeModel.Claude_Opus_4_6, label: "Claude Opus 4.6" },
        { value: OpenCodeModel.Claude_Opus_4_5, label: "Claude Opus 4.5" },
        { value: OpenCodeModel.Claude_Sonnet_5, label: "Claude Sonnet 5" },
        { value: OpenCodeModel.Claude_Sonnet_4_6, label: "Claude Sonnet 4.6" },
        { value: OpenCodeModel.Claude_Sonnet_4_5, label: "Claude Sonnet 4.5" },
        { value: OpenCodeModel.Claude_Sonnet_4, label: "Claude Sonnet 4" },
        { value: OpenCodeModel.Claude_Haiku_4_5, label: "Claude Haiku 4.5" },
      ],
    },
    {
      label: "OpenAI",
      options: [
        { value: OpenCodeModel.GPT_5_5, label: "GPT-5.5" },
        { value: OpenCodeModel.GPT_5_4, label: "GPT-5.4" },
        { value: OpenCodeModel.GPT_5_4_Pro, label: "GPT-5.4 Pro" },
        { value: OpenCodeModel.GPT_5_4_Mini, label: "GPT-5.4 Mini" },
        { value: OpenCodeModel.GPT_5_4_Nano, label: "GPT-5.4 Nano" },
        { value: OpenCodeModel.GPT_5_3_Codex, label: "GPT-5.3 Codex" },
        {
          value: OpenCodeModel.GPT_5_3_Codex_Spark,
          label: "GPT-5.3 Codex Spark",
        },
      ],
    },
    {
      label: "Other",
      options: [
        { value: OpenCodeModel.Zen_Gemini_3_1_Pro, label: "Gemini 3.1 Pro" },
        { value: OpenCodeModel.Zen_Gemini_3_Pro, label: "Gemini 3 Pro" },
        { value: OpenCodeModel.Zen_Gemini_3_Flash, label: "Gemini 3 Flash" },
        { value: OpenCodeModel.Zen_GPT_5_Nano, label: "GPT-5 Nano (Free)" },
        { value: OpenCodeModel.Zen_Big_Pickle, label: "Big Pickle (Free)" },
      ],
    },
  ],
  [Agent.Cursor]: [
    {
      label: "Cursor",
      options: [
        { value: CursorModel.Composer_2_5, label: "Composer 2.5" },
        { value: CursorModel.Default, label: "Default" },
        { value: CursorModel.GPT_5_4, label: "GPT-5.4" },
        { value: CursorModel.Claude_Fable_5, label: "Claude Fable 5" },
        { value: CursorModel.Claude_Opus_5, label: "Claude Opus 5" },
        { value: CursorModel.Claude_Opus_4_7, label: "Claude Opus 4.7" },
        { value: CursorModel.Claude_Sonnet_5, label: "Claude Sonnet 5" },
      ],
    },
  ],
};

/**
 * Per-harness "recommended" model values (newest / most capable). The model
 * keyboard renders these with a ⭐ so they stand out on the first page.
 */
export const RECOMMENDED_BY_AGENT: Record<string, string[]> = {
  [Agent.ClaudeCode]: [
    ClaudeCode.Fable_5,
    ClaudeCode.Opus_5,
    ClaudeCode.Opus_4_8,
  ],
  [Agent.Codex]: [OpenAICodex.GPT_5_5, OpenAICodex.GPT_5_4],
  [Agent.OpenCode]: [
    OpenCodeModel.Claude_Opus_5,
    OpenCodeModel.Claude_Opus_4_8,
    OpenCodeModel.GPT_5_5,
    OpenCodeModel.Zen_Gemini_3_1_Pro,
  ],
  [Agent.Cursor]: [CursorModel.Composer_2_5],
};

export const HARNESS_OPTIONS = [
  { value: Agent.ClaudeCode, label: "Claude Code" },
  { value: Agent.Codex, label: "OpenAI Codex" },
  { value: Agent.OpenCode, label: "OpenCode" },
  { value: Agent.Cursor, label: "Cursor" },
];

export const RUNTIME_OPTIONS = [
  { value: "node", label: "Node.js" },
  { value: "python", label: "Python" },
  { value: "golang", label: "Go" },
  { value: "ruby", label: "Ruby" },
  { value: "rust", label: "Rust" },
];

/** Flatten a harness's groups into a single newest-first option list. */
export function flatModelOptions(harness: string): ModelOption[] {
  return (MODEL_OPTIONS_BY_AGENT[harness] ?? []).flatMap((g) => g.options);
}

// Build-time self-check: every recommended value must be a real option for its
// harness. Catches typos and SDK renames before they reach a user (the model
// `value`s themselves are already enum-typed, so a removed enum member fails to
// compile — this guards the hand-written RECOMMENDED list).
for (const [harness, recommended] of Object.entries(RECOMMENDED_BY_AGENT)) {
  const values = new Set(flatModelOptions(harness).map((o) => o.value));
  for (const value of recommended) {
    if (!values.has(value)) {
      throw new Error(
        `RECOMMENDED_BY_AGENT[${harness}] lists "${value}" which is not in MODEL_OPTIONS_BY_AGENT[${harness}].`,
      );
    }
  }
}
