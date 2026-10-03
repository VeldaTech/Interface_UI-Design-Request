import assert from "node:assert/strict"
import test from "node:test"
import { parseRuntimeEvent, resolveVoiceDelivery } from "../src/app/runtimeContract.ts"
import { emptyWorkspace, parseWorkspaceBackup, serializeWorkspace } from "../src/app/localWorkspace.ts"

test("activity and health remain independent validated events", () => {
  assert.equal(parseRuntimeEvent({ type: "activity", activity: "WORKING" }).activity, "WORKING")
  assert.equal(parseRuntimeEvent({ type: "health", health: "DEGRADED" }).health, "DEGRADED")
  assert.equal(parseRuntimeEvent({ type: "notification", pending: true }).pending, true)
  for (const event of [null, [], { type: "activity", activity: "ERROR" }, { type: "health", health: "THINKING" }, { type: "notification", pending: 1 }, { type: "activity", activity: { toString: () => "IDLE" } }]) assert.equal(parseRuntimeEvent(event), null)
})

test("reply boundary rejects corrupt payloads and keeps literal text", () => {
  const reply = { type: "reply", id: "reply-1", content: "<script>literal text</script>" }
  assert.equal(parseRuntimeEvent(reply).content, reply.content)
  for (const extra of [{ id: "" }, { content: " " }, { content: "a".repeat(20001) }, { speechAvailable: "true" }, { voice: { voice_language: "ja", spoken_en: "Wrong field" } }, { voice: { voice_language: "en", spoken_en: "Hello", subtitle_ja: [] } }]) assert.equal(parseRuntimeEvent({ ...reply, ...extra }), null)
})

test("unavailable Japanese speech never silently switches to English", () => {
  const delivery = resolveVoiceDelivery({ voice_language: "en", spoken_en: "Hello" }, { voiceLanguage: "ja", subtitleMode: "en" }, true)
  assert.equal(delivery.spokenText, null)
  assert.match(delivery.notices[0], /Japanese voice unavailable/)
  assert.deepEqual(delivery.subtitles, [{ language: "en", text: "Hello" }])
})

test("missing translation retains original text with a notice", () => {
  const delivery = resolveVoiceDelivery({ voice_language: "ja", spoken_ja: "こんにちは" }, { voiceLanguage: "ja", subtitleMode: "en" })
  assert.deepEqual(delivery.subtitles, [{ language: "ja", text: "こんにちは" }])
  assert.ok(delivery.notices.includes("English subtitles unavailable."))
  assert.ok(delivery.notices.includes("Showing the original Japanese text."))
})

test("speech and subtitle selections remain independent", () => {
  const response = { voice_language: "ja", spoken_ja: "こんにちは", subtitle_en: "Hello" }
  const both = resolveVoiceDelivery(response, { voiceLanguage: "ja", subtitleMode: "both" }, true)
  assert.equal(both.spokenText, response.spoken_ja)
  assert.deepEqual(both.subtitles, [{ language: "en", text: "Hello" }, { language: "ja", text: "こんにちは" }])
  assert.deepEqual(both.notices, [])
  assert.deepEqual(resolveVoiceDelivery(response, { voiceLanguage: "ja", subtitleMode: "off" }, true).subtitles, [])
})

test("legacy messages migrate and duplicate identities are rejected", () => {
  const workspace = emptyWorkspace()
  workspace.chatMessages = [{ role: "user", content: "Keep me" }]
  const restored = parseWorkspaceBackup(serializeWorkspace(workspace))
  assert.deepEqual(restored.chatMessages, [{ id: "legacy-message-0", role: "user", content: "Keep me", source: "preview" }])
  restored.chatMessages.push({ ...restored.chatMessages[0] })
  assert.throws(() => parseWorkspaceBackup(serializeWorkspace(restored)), /duplicate/)
})
