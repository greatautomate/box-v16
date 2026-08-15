import {
  Agent,
  ClaudeCode,
  CursorModel,
  OpenAICodex,
  OpenCodeModel,
  OpenRouterModel,
} from "@upstash/box";

// OpenRouterModel is re-exported for callers that reference it directly; the
// curated lists below mirror packages/telegram-bot/src/services/model-registry.ts.
export { OpenRouterModel };

/**
 * Model options grouped by agent. Kept in sync with the Telegram bot's
 * model-registry.ts — options are ordered newest-first.
 */
export const MODEL_OPTIONS_BY_AGENT: Record<
  Agent,
  { label: string; options: { value: string; label: string }[] }[]
> = {
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
        { value: OpenAICodex.GPT_5_3_Codex_Spark, label: "GPT-5.3 Codex Spark" },
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
        { value: OpenCodeModel.GPT_5_3_Codex_Spark, label: "GPT-5.3 Codex Spark" },
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
  [Agent.Custom]: [
    {
      label: "Custom",
      options: [{ value: "custom", label: "Custom" }],
    },
  ],
};
