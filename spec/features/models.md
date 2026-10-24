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

### MOD-002: Live Model Discovery and Filtering
WHEN an author triggers model querying for an AI provider,
THE SYSTEM SHALL query the provider's remote API, filter the returned model list to canonical top models matching Antigravity suggestions, and exclude experimental/dated snapshots.

Acceptance:
- Given a raw list of 46 Google Gemini models including dated snapshots and embeddings,
  when filterTopModels is invoked with provider "gemini",
  then only the curated top suggestions ('gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro', 'gemini-1.5-flash') are returned.
- Given an Anthropic model list containing legacy versions,
  when filterTopModels is invoked for "anthropic",
  then only Claude 3.x models are returned in priority order.

### MOD-003: Reactive Model Selector with Custom Fallback
WHEN an author configures the active model in Settings,
THE SYSTEM SHALL present a reactive native select menu with formatted human-readable labels and permit specifying custom model identifiers.

Acceptance:
- Given the active provider has 6 top models available,
  when rendered in the settings modal,
  then a native select element displays all 6 models with descriptive labels (e.g. "Gemini 2.5 Pro (Flagship)") and includes a "Custom Model ID..." option.
- Given an author chooses "Custom Model ID...",
  when selected,
  then a text input appears permitting arbitrary model strings.
