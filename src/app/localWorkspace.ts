import type { CorePreview } from "./App"

export type VoicePreferences = {
  voiceLanguage: "en" | "ja"
  subtitleMode: "en" | "ja" | "both" | "off"
  subtitlePreferenceExplicit: boolean
}
export type { VoiceResponse } from "./runtimeContract"
export type ChatMessage = { id: string; role: "user" | "assistant"; content: string; source: "preview" | "runtime" }

export function createPreviewMessage(role: ChatMessage["role"], content: string): ChatMessage {
  return { id: crypto.randomUUID(), role, content, source: "preview" }
}

export function getVoiceRuntimePreference(preferences: VoicePreferences) {
  return {
    voiceLanguage: preferences.voiceLanguage,
    subtitleMode: preferences.subtitleMode,
    voiceIdentity: "ciel-g6" as const,
    bindingStatus: "pending" as const,
  }
}

export type EditorDrafts = {
  context: { title: string; content: string; selectedId: string | null; editingId: string | null; editTitle: string; editContent: string }
  planning: { draft: string }
  workflow: { name: string; trigger: string; destination: string; cadence: string; selectedId: string | null; editingId: string | null }
  notes: { selected: number | null; title: string; body: string }
}
export type WorkspaceData = Pick<CorePreview, "chatDraft" | "chatMessages" | "contextItems" | "planGoal" | "planSteps" | "automationDrafts" | "preferences" | "referenceNotes" | "editorDrafts">
export const workspaceStorageKey = "ciel-workspace-v1"

export function readMotionPreference() {
  try { return localStorage.getItem("ciel-motion") } catch { return null }
}

export function emptyWorkspace(): WorkspaceData {
  return { chatDraft: "", chatMessages: [], contextItems: [], planGoal: "", planSteps: [], automationDrafts: [], referenceNotes: [], preferences: { model: "Not selected", startup: "Core", confirmations: "Always ask", density: "Comfortable", voiceLanguage: "en", subtitleMode: "en", subtitlePreferenceExplicit: false }, editorDrafts: { context: { title: "", content: "", selectedId: null, editingId: null, editTitle: "", editContent: "" }, planning: { draft: "" }, workflow: { name: "", trigger: "Messenger", destination: "Discord", cadence: "On event", selectedId: null, editingId: null }, notes: { selected: null, title: "", body: "" } } }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function list(value: unknown, valid: (item: Record<string, unknown>) => boolean) {
  return Array.isArray(value) && value.every((item) => record(item) && valid(item))
}

function choice(value: unknown, choices: string[]) {
  return typeof value === "string" && choices.includes(value)
}

function validWorkspace(value: unknown): value is WorkspaceData {
  if (!record(value) || !record(value.preferences)) return false
  const preferences = value.preferences
  return typeof value.chatDraft === "string" && typeof value.planGoal === "string"
    && list(value.chatMessages, (item) => choice(item.role, ["user", "assistant"]) && typeof item.content === "string" && (item.id === undefined || typeof item.id === "string" && Boolean(item.id)) && (item.source === undefined || choice(item.source, ["preview", "runtime"])))
    && list(value.contextItems, (item) => typeof item.id === "string" && typeof item.title === "string" && typeof item.content === "string" && typeof item.pinned === "boolean" && choice(item.source, ["Manual", "File"]) && (item.edited === undefined || typeof item.edited === "boolean"))
    && list(value.planSteps, (item) => typeof item.id === "string" && typeof item.title === "string" && typeof item.note === "string" && typeof item.stage === "number" && Number.isInteger(item.stage) && item.stage >= 0 && item.stage <= 3 && choice(item.agent, ["Unassigned", "Coding agent", "Research agent", "Architect agent", "School Agent"]))
    && list(value.automationDrafts, (item) => typeof item.id === "string" && typeof item.name === "string" && typeof item.enabled === "boolean" && choice(item.trigger, ["Messenger", "Classroom", "GitHub", "Schedule"]) && choice(item.destination, ["Discord", "Local summary"]) && choice(item.cadence, ["On event", "Daily", "Weekly"]))
    && list(value.referenceNotes, (item) => typeof item.title === "string" && typeof item.body === "string")
    && choice(preferences.model, ["Not selected", "Luna", "Sol", "Astra", "Local Qwen"])
    && choice(preferences.startup, ["Core", "Conversation"])
    && choice(preferences.confirmations, ["Always ask", "Ask before changes"])
    && choice(preferences.density, ["Comfortable", "Compact"])
    && (preferences.voiceLanguage === undefined || choice(preferences.voiceLanguage, ["en", "ja"]))
    && (preferences.subtitleMode === undefined || choice(preferences.subtitleMode, ["en", "ja", "both", "off"]))
    && (preferences.subtitlePreferenceExplicit === undefined || typeof preferences.subtitlePreferenceExplicit === "boolean")
}

export function parseWorkspaceBackup(text: string): WorkspaceData {
  const parsed: unknown = JSON.parse(text)
  if (!record(parsed) || parsed.version !== 1 || !validWorkspace(parsed.data)) throw new Error("Choose a CIEL version 1 backup with valid workspace data.")
  const data = parsed.data
  const chatMessages = data.chatMessages.map((message, index) => ({ ...message, id: message.id ?? `legacy-message-${index}`, source: message.source ?? "preview" as const }))
  for (const items of [chatMessages, data.contextItems, data.planSteps, data.automationDrafts]) {
    if (new Set(items.map((item) => item.id)).size !== items.length || items.some((item) => !item.id)) throw new Error("This backup has missing or duplicate item identities.")
  }
  const drafts = data.editorDrafts === undefined ? emptyWorkspace().editorDrafts : data.editorDrafts
  const hasId = (id: unknown, items: { id: string }[]) => id === null || typeof id === "string" && items.some((item) => item.id === id)
  if (!record(drafts) || !record(drafts.context) || !record(drafts.planning) || !record(drafts.workflow) || !record(drafts.notes)) throw new Error("This backup has invalid unfinished edits.")
  const { context, planning, workflow, notes } = drafts
  if (![context.title, context.content, context.editTitle, context.editContent, planning.draft, workflow.name, notes.title, notes.body].every((value) => typeof value === "string")
    || !hasId(context.selectedId, data.contextItems) || !hasId(context.editingId, data.contextItems)
    || !hasId(workflow.selectedId, data.automationDrafts) || !hasId(workflow.editingId, data.automationDrafts)
    || !choice(workflow.trigger, ["Messenger", "Classroom", "GitHub", "Schedule"])
    || !choice(workflow.destination, ["Discord", "Local summary"]) || !choice(workflow.cadence, ["On event", "Daily", "Weekly"])
    || !(notes.selected === null || typeof notes.selected === "number" && Number.isInteger(notes.selected) && notes.selected >= 0 && notes.selected < data.referenceNotes.length)) throw new Error("This backup has invalid unfinished edits.")
  return { ...data, chatMessages, preferences: { ...emptyWorkspace().preferences, ...data.preferences }, editorDrafts: drafts as EditorDrafts }
}

export function readLocalWorkspace(): { data: WorkspaceData; issue: string; saved: string | null } {
  let saved: string | null = null
  try {
    saved = localStorage.getItem(workspaceStorageKey)
    if (saved === null) return { data: emptyWorkspace(), issue: "", saved }
    return { data: parseWorkspaceBackup(saved), issue: "", saved }
  } catch {
    return { data: emptyWorkspace(), issue: "The saved workspace could not be read. Saving is paused to protect any stored copy. Download the stored copy before resetting local data.", saved }
  }
}

export function serializeWorkspace(data: WorkspaceData) {
  return JSON.stringify({ version: 1, data })
}

export function saveLocalWorkspace(data: WorkspaceData, expected: string | null) {
  try {
    if (localStorage.getItem(workspaceStorageKey) !== expected) return { saved: expected, blocked: true, issue: "The saved workspace changed in another tab. Saving is paused to protect it. Download a backup of this tab's changes, then refresh to load the saved workspace." }
    const saved = serializeWorkspace(data)
    localStorage.setItem(workspaceStorageKey, saved)
    return { saved, blocked: false, issue: "" }
  } catch {
    return { saved: expected, blocked: false, issue: "Browser saving is unavailable or full. Your changes remain in this tab. Download a backup before refreshing, or free browser storage and retry saving." }
  }
}
