export type CoreActivity = "IDLE" | "LISTENING" | "THINKING" | "SPEAKING" | "WORKING"
export type ConnectionHealth = "OFFLINE" | "CONNECTED" | "DEGRADED" | "ERROR"
export type VoiceResponse =
  | { voice_language: "en"; spoken_en: string; subtitle_en?: string; subtitle_ja?: string }
  | { voice_language: "ja"; spoken_ja: string; subtitle_en?: string; subtitle_ja?: string }
export type RuntimeEvent =
  | { type: "activity"; activity: CoreActivity }
  | { type: "health"; health: ConnectionHealth }
  | { type: "notification"; pending: boolean }
  | { type: "reply"; id: string; content: string; voice?: VoiceResponse; speechAvailable?: boolean }

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
function text(value: unknown): value is string {
  return typeof value === "string" && value.length <= 20000
}
export function parseRuntimeEvent(value: unknown): RuntimeEvent | null {
  if (!record(value)) return null
  if (value.type === "activity" && typeof value.activity === "string" && ["IDLE", "LISTENING", "THINKING", "SPEAKING", "WORKING"].includes(value.activity)) return { type: "activity", activity: value.activity as CoreActivity }
  if (value.type === "health" && typeof value.health === "string" && ["OFFLINE", "CONNECTED", "DEGRADED", "ERROR"].includes(value.health)) return { type: "health", health: value.health as ConnectionHealth }
  if (value.type === "notification" && typeof value.pending === "boolean") return { type: "notification", pending: value.pending }
  if (value.type !== "reply" || typeof value.id !== "string" || !value.id.trim() || value.id.length > 256 || !text(value.content) || !value.content.trim()) return null
  if (value.speechAvailable !== undefined && typeof value.speechAvailable !== "boolean") return null
  if (value.voice !== undefined) {
    const voice = value.voice
    if (!record(voice) || typeof voice.voice_language !== "string" || !["en", "ja"].includes(voice.voice_language)
      || !text(voice.voice_language === "ja" ? voice.spoken_ja : voice.spoken_en)
      || voice.subtitle_en !== undefined && !text(voice.subtitle_en)
      || voice.subtitle_ja !== undefined && !text(voice.subtitle_ja)) return null
  }
  return { type: "reply", id: value.id, content: value.content, voice: value.voice as VoiceResponse | undefined, speechAvailable: value.speechAvailable as boolean | undefined }
}

export function resolveVoiceDelivery(response: VoiceResponse, preferences: { voiceLanguage: "en" | "ja"; subtitleMode: "en" | "ja" | "both" | "off" }, speechAvailable = false) {
  const sourceText = response.voice_language === "ja" ? response.spoken_ja : response.spoken_en
  const notices: string[] = []
  const canSpeak = speechAvailable && response.voice_language === preferences.voiceLanguage && Boolean(sourceText.trim())
  if (!canSpeak) notices.push(`${preferences.voiceLanguage === "ja" ? "Japanese" : "English"} voice unavailable. Text only; no other voice was selected.`)
  const subtitles: { language: "en" | "ja"; text: string }[] = []
  if (preferences.subtitleMode !== "off") {
    const languages = preferences.subtitleMode === "both" ? ["en", "ja"] as const : [preferences.subtitleMode] as const
    for (const language of languages) {
      const translated = language === "en" ? response.subtitle_en : response.subtitle_ja
      const content = translated?.trim() || (response.voice_language === language ? sourceText.trim() : "")
      if (content) subtitles.push({ language, text: content })
      else notices.push(`${language === "en" ? "English" : "Japanese"} subtitles unavailable.`)
    }
    if (!subtitles.length && sourceText.trim()) {
      subtitles.push({ language: response.voice_language, text: sourceText })
      notices.push(`Showing the original ${response.voice_language === "ja" ? "Japanese" : "English"} text.`)
    }
  }
  return { spokenText: canSpeak ? sourceText : null, subtitles, notices }
}
