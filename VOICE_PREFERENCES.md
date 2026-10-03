# CIEL voice preferences

The Voice card in Settings owns the controls. Language and subtitles live in the existing `preferences` object and `ciel-workspace-v1` backup; older backups acquire English defaults without losing other data.

- `voiceLanguage`: `en` or `ja`; default `en`.
- `subtitleMode`: `en`, `ja`, `both`, or `off`; default `en`.
- `subtitlePreferenceExplicit`: becomes true when the user selects subtitles. Language changes preserve subtitles.

`getVoiceRuntimePreference(preferences)` in `src/app/localWorkspace.ts` derives the runtime configuration. Destination pages receive it through `CorePreview.voiceRuntimePreference`; this is not a second settings store. Both languages use the `ciel-g6` identity key. The actual voice binding is pending; the key is not an audio asset or provider voice ID.

The exported `VoiceResponse` type supports English spoken text or Japanese spoken text with optional English and Japanese subtitles. A future runtime should consume the current preferences when starting the next response. Existing sample text replies are unchanged.

Input recognition language is not configured by this selector. No microphone, playback, provider request, or TTS runtime is activated by a preference change. No experimental voice files are used or modified.

Run preference checks with `node --test tests/voice-preferences.test.mjs` (Node 24).
