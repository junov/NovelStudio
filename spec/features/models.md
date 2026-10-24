---
prefix: MOD
status: active
---
# AI Provider and Model Management

## Requirements

### MOD-001: OS Keychain Credential Storage
WHEN an author inputs an API key for Anthropic, OpenAI, or Gemini,
THE SYSTEM SHALL store the credential securely in the operating system's native keychain and retrieve it on demand without writing plain text to disk.

Acceptance:
- Given an author enters a valid API key string for "gemini",
  when saveKeys is executed,
  then the key is written to the OS credential manager under service "dev.junov.novelstudio" and not present in settings.json.
- Given a previously saved key in the OS credential manager,
  when the application boots,
  then secretGet retrieves the key value into memory.

### MOD-002: Dynamic Backend Model Discovery
WHEN an author triggers model querying for an AI provider or configures an API key,
THE SYSTEM SHALL query the provider's remote model listing API, extract all available text generation models dynamically without using hard-coded model identifier whitelists, and exclude non-text models (such as embeddings, image generation, and audio models) based on capability metadata and category patterns.

Acceptance:
- Given an API response from Google Gemini containing text generation models alongside embedding or internal models,
  when filterGenerativeModels is executed,
  then models lacking "generateContent" capability and non-chat models (e.g. containing "embedding", "aqa", "imagen") are excluded, and all valid generative models are returned without hardcoding specific model identifiers.
- Given any newly released model returned by a provider backend (e.g. "gemini-4-argon", "gemini-3.8-flash", "claude-opus-5.5"),
  when models are queried,
  then the models are discovered dynamically and made available in the selector without requiring code changes.
- Given a list of returned models from OpenAI or Anthropic with creation timestamps,
  when sorted,
  then models are ordered with the most recent models first.

### MOD-003: Dynamic Model Selector with Provider Display Names
WHEN an author configures the active model in Settings,
THE SYSTEM SHALL present a reactive native select menu populated with dynamically discovered models using provider-supplied display names (or formatted identifiers) and support a custom identifier fallback option.

Acceptance:
- Given models retrieved dynamically from the backend with display names or identifiers,
  when rendered in the settings modal,
  then a native select element displays the retrieved models with their display names and raw IDs, plus a "Custom Model ID..." option.
- Given an author chooses "Custom Model ID...",
  when selected,
  then a text input appears permitting arbitrary model strings.

### MOD-004: Configurable Thinking Levels for Reasoning Models
WHEN an author configures model options in Settings,
THE SYSTEM SHALL present a Thinking Level control with choices (Off, Low, Medium, High) and include the appropriate reasoning effort or thinking budget configuration in provider API requests for models with thinking enabled.

Acceptance:
- Given any model configured in Settings,
  when viewed,
  then the UI displays a Thinking Level selector with options "Off", "Low", "Medium", and "High".
- Given a thinking level of "High" is configured for a model,
  when an agent prompt is dispatched,
  then the provider request payload includes the corresponding reasoning parameter (OpenAI reasoning_effort: "high", Anthropic thinking: { type: "enabled", budget_tokens: 32000 }, Gemini thinkingConfig).
- Given thinking level is set to "Off",
  when an agent prompt is dispatched,
  then no thinking or reasoning parameters are included in the request payload.
