# Issues

## Resolved this session

- [x] Default OpenRouter model slug was `anthropic/claude-haiku-4-5-20251001` (Anthropic native format, rejected by OpenRouter) → fixed to `openrouter/owl-alpha`
- [x] API key field in admin always started empty — saving blank would wipe a stored key → guarded with disabled button + "key is configured" indicator
- [x] AI helper tile re-appeared after removal (migration ran on every launch) → added one-time migration flag `migrations.aiTileAdded`
- [x] orchestrate.sh external providers (Gemini, Codex) not authenticated — multi-LLM phases fell back to Claude-only

## Open

- [ ] OpenRouter model slug `openrouter/owl-alpha` unverified — confirm against openrouter.ai/models
- [ ] Voice input (SpeechRecognition) not available in Electron renderer by default — may need `--enable-features=WebSpeechAPI` flag or similar
