import assert from "node:assert/strict"
import test from "node:test"
import { emptyWorkspace, getVoiceRuntimePreference, parseWorkspaceBackup, readLocalWorkspace, saveLocalWorkspace, serializeWorkspace } from "../src/app/localWorkspace.ts"

test("new workspace defaults to English voice and subtitles with pending speech binding", () => {
  const { preferences } = emptyWorkspace()
  assert.equal(preferences.subtitlePreferenceExplicit, false)
  assert.deepEqual(getVoiceRuntimePreference(preferences), { voiceLanguage: "en", subtitleMode: "en", voiceIdentity: "ciel-g6", bindingStatus: "pending" })
})

test("existing version 1 backups acquire defaults without losing workspace data", () => {
  const data = emptyWorkspace()
  data.chatDraft = "Keep this draft"
  data.preferences.model = "Sol"
  delete data.preferences.voiceLanguage
  delete data.preferences.subtitleMode
  delete data.preferences.subtitlePreferenceExplicit
  const restored = parseWorkspaceBackup(serializeWorkspace(data))
  assert.equal(restored.chatDraft, "Keep this draft")
  assert.equal(restored.preferences.model, "Sol")
  assert.equal(restored.preferences.voiceLanguage, "en")
  assert.equal(restored.preferences.subtitleMode, "en")
  assert.equal(restored.preferences.subtitlePreferenceExplicit, false)
})

test("both languages preserve every explicit subtitle choice across backups", () => {
  for (const subtitleMode of ["en", "ja", "both", "off"]) {
    const data = emptyWorkspace()
    data.preferences.subtitleMode = subtitleMode
    data.preferences.subtitlePreferenceExplicit = true
    for (const voiceLanguage of ["ja", "en", "ja"]) {
      data.preferences.voiceLanguage = voiceLanguage
      const restored = parseWorkspaceBackup(serializeWorkspace(data))
      assert.deepEqual(restored, data)
      assert.equal(getVoiceRuntimePreference(restored.preferences).subtitleMode, subtitleMode)
    }
  }
})

test("Japanese first use retains English subtitles", () => {
  const data = emptyWorkspace()
  data.preferences.voiceLanguage = "ja"
  const restored = parseWorkspaceBackup(serializeWorkspace(data))
  assert.equal(restored.preferences.subtitleMode, "en")
  assert.equal(restored.preferences.subtitlePreferenceExplicit, false)
})

test("invalid voice preferences are rejected before restoring a backup", () => {
  for (const [field, value] of [["voiceLanguage", "fr"], ["voiceLanguage", null], ["subtitleMode", "auto"], ["subtitleMode", null], ["subtitlePreferenceExplicit", "true"]]) {
    const data = emptyWorkspace()
    data.preferences[field] = value
    assert.throws(() => parseWorkspaceBackup(serializeWorkspace(data)))
  }
})

test("voice selections survive browser storage reload alongside unrelated settings", () => {
  const previousStorage = globalThis.localStorage
  const stored = new Map()
  globalThis.localStorage = { getItem: (key) => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) }
  try {
    const data = emptyWorkspace()
    Object.assign(data.preferences, { voiceLanguage: "ja", subtitleMode: "off", subtitlePreferenceExplicit: true, density: "Compact" })
    const result = saveLocalWorkspace(data, null)
    assert.equal(result.issue, "")
    assert.deepEqual(readLocalWorkspace().data, data)
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage
    else globalThis.localStorage = previousStorage
  }
})
