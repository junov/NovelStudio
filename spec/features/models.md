---
prefix: MOD
status: active
---
# AI Provider and Model Management

## Requirements

### MOD-001: OS Keychain Credential Storage
WHEN an author inputs an API key for Gemini,
THE SYSTEM SHALL store the credential securely in the operating system's native keychain and retrieve it on demand without writing plain text to disk.

Acceptance:
- Given an author enters a valid API key string for "gemini",
  when saveKeys is executed,
  then the key is written to the OS credential manager under service "dev.junov.novelstudio" and not present in settings.json.
- Given a previously saved key in the OS credential manager,
  when the application boots,
  then secretGet retrieves the key value into memory.
- Given the Settings window or modal,
  when viewed,
  then the API key configuration section is positioned below the provider and model selection controls.
- Given the active AI provider in Settings is not Gemini (e.g. Antigravity CLI),
  when viewing settings,
  then the Gemini API key text box is hidden from the UI.
- Given the active AI provider in Settings is Gemini,
  when viewing settings,
  then the Gemini API key text box is displayed.

### MOD-002: Dynamic Backend Model Discovery
WHEN an author triggers model querying for an AI provider or configures an API key,
THE SYSTEM SHALL query the provider's remote model listing API, extract all available text generation models dynamically without using hard-coded model identifier whitelists, and exclude non-text models (such as embeddings, image generation, and audio models) based on capability metadata and category patterns.

Acceptance:
- Given an API response from Google Gemini containing text generation models alongside embedding or internal models,
  when filterGenerativeModels is executed,
  then models lacking "generateContent" capability and non-chat models (e.g. containing "embedding", "aqa", "imagen") are excluded, and all valid generative models are returned without hardcoding specific model identifiers.
- Given any newly released model returned by a provider backend (e.g. "gemini-4-argon", "gemini-3.8-flash"),
  when models are queried,
  then the models are discovered dynamically and made available in the selector without requiring code changes.
- Given models returned by Google Gemini or the Antigravity CLI driver,
  when queried,
  then available text generation models are discovered dynamically without requiring hardcoded model whitelists.

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
- Given the Model Selection control in Settings,
  when viewed,
  then a "Refresh List" button appears right next to the "Model Selection" label to query and update the list of available models from the active provider.

### MOD-004: Configurable Thinking Levels for Reasoning Models
WHEN an author configures model options in Settings,
THE SYSTEM SHALL present a Thinking Level control with choices (Off, Low, Medium, High) and include the appropriate reasoning effort or thinking budget configuration in provider API requests for models with thinking enabled.

Acceptance:
- Given any model configured in Settings,
  when viewed,
  then the UI displays a Thinking Level selector with options "Off", "Low", "Medium", and "High".
- Given a thinking level of "High" is configured for a model,
  when an agent prompt is dispatched,
  then the provider request payload includes the corresponding reasoning parameter (Gemini thinkingConfig).
- Given thinking level is set to "Off",
  when an agent prompt is dispatched,
  then no thinking or reasoning parameters are included in the request payload.

### MOD-005: Cross-Window Settings Propagation and Store Persistence
WHEN settings or model choices are saved in a settings window or modal,
THE SYSTEM SHALL flush the settings store to persistent disk storage immediately, broadcast a settings update event across all open application windows, and update active in-memory settings state in the main window without requiring an application restart.

Acceptance:
- Given an author changes settings (such as the default model or thinking level) in the dedicated settings window or modal,
  when saveKeys or settings.save is invoked,
  then changes are flushed to disk storage and a cross-window change notification is broadcast.
- Given the main application window or any other open window,
  when a settings change notification is received,
  then the window reactively updates its in-memory settings, model indicators, and active agent model selection.
- Given the main window regains window focus,
  when focused,
  then it synchronizes in-memory settings with persistent storage to capture external updates.

### MOD-006: Gemini Tool Execution Protocol and Struct Marshaling
WHEN an LLM agent executes tool calls against the Google Gemini API,
THE SYSTEM SHALL marshal tool response payloads into valid protobuf Struct key-value objects, wrapping array and primitive outputs under an object key so that functionResponse payloads satisfy Gemini API schema requirements.

Acceptance:
- Given a tool result that returns a JSON array (such as ask_user answers or list_project_files listings),
  when formatted for Gemini contents payload,
  then functionResponse.response is structured as a JSON object wrapping the array under a property key (e.g. output) rather than a bare array list.
- Given a tool result that returns an unparsed string or primitive,
  when formatted for Gemini,
  then functionResponse.response wraps the primitive value in a JSON object.
- Given a tool result that returns a JSON object dictionary,
  when formatted for Gemini,
  then functionResponse.response preserves the object mapping directly.

### MOD-007: Gemini Thought Signature Preservation across Tool Turns
WHEN a reasoning-capable Google Gemini model returns function calls containing thought signatures,
THE SYSTEM SHALL capture and retain the complete model content parts verbatim and echo the thoughtSignature back in conversation history during subsequent tool result turns.

Acceptance:
- Given a response from a Gemini model containing one or more functionCall parts with thoughtSignature or thought_signature metadata,
  when received by the LLM client,
  then the raw parts and thought signatures are captured and retained in the conversation message history.
- Given subsequent prompt requests containing tool execution results for previously invoked function calls,
  when building the Gemini contents payload,
  then the assistant turn preserves the verbatim model parts including thoughtSignature so that reasoning context is round-tripped without validation errors.
