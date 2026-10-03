import { useEffect, useLayoutEffect, useMemo, useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from "react"
import RingWorkspace, { conversationWorkspace, ringWorkspaces, workspaces } from "./RingWorkspaces"
import { emptyWorkspace, getVoiceRuntimePreference, readLocalWorkspace, readMotionPreference, saveLocalWorkspace, serializeWorkspace, workspaceStorageKey, type EditorDrafts, type VoicePreferences, type WorkspaceData } from "./localWorkspace"
import {
  createBrowserRouter,
  NavLink,
  Outlet,
  RouterProvider,
  useLocation,
  useNavigate,
  useOutletContext,
} from "react-router"
import {
  ArrowRight,
  ArrowUp,
  Bell,
  BookOpen,
  Cpu,
  Home,
  ListChecks,
  Menu,
  MessageSquare,
  Mic,
  Network,
  Terminal,
  X,
} from "lucide-react"

type CoreState = "IDLE" | "LISTENING" | "THINKING" | "SPEAKING" | "WORKING"
type CoreHealth = "OFFLINE" | "CONNECTED" | "DEGRADED" | "ERROR"
export type CorePreview = {
  state: CoreState
  setState: Dispatch<SetStateAction<CoreState>>
  health: CoreHealth
  setHealth: Dispatch<SetStateAction<CoreHealth>>
  notification: boolean
  setNotification: Dispatch<SetStateAction<boolean>>
  motionEnabled: boolean
  setMotionEnabled: (enabled: boolean) => void
  chatDraft: string
  setChatDraft: Dispatch<SetStateAction<string>>
  chatMessages: import("./localWorkspace").ChatMessage[]
  setChatMessages: Dispatch<SetStateAction<import("./localWorkspace").ChatMessage[]>>
  contextItems: { id: string; title: string; content: string; pinned: boolean; source: "Manual" | "File"; edited?: boolean }[]
  setContextItems: Dispatch<SetStateAction<CorePreview["contextItems"]>>
  planGoal: string
  setPlanGoal: Dispatch<SetStateAction<string>>
  planSteps: { id: string; title: string; stage: number; note: string; agent: string }[]
  setPlanSteps: Dispatch<SetStateAction<CorePreview["planSteps"]>>
  automationDrafts: { id: string; name: string; trigger: string; destination: string; cadence: string; enabled: boolean }[]
  setAutomationDrafts: Dispatch<SetStateAction<CorePreview["automationDrafts"]>>
  preferences: { model: string; startup: string; confirmations: string; density: string } & VoicePreferences
  voiceRuntimePreference: ReturnType<typeof getVoiceRuntimePreference>
  setPreferences: Dispatch<SetStateAction<CorePreview["preferences"]>>
  referenceNotes: { title: string; body: string }[]
  setReferenceNotes: Dispatch<SetStateAction<CorePreview["referenceNotes"]>>
  editorDrafts: EditorDrafts
  setEditorDrafts: Dispatch<SetStateAction<EditorDrafts>>
  localSaveStatus: string
  localSavingIssue: string
  localSavingBlocked: boolean
  retryLocalSaving: () => void
  downloadLocalBackup: (stored?: boolean) => void
  resetLocalWorkspace: () => void
  restoreLocalBackup: (data: WorkspaceData) => string
}
const coreMotionPhases = new Map<string, { phase: number; rate: number; time: number; running: boolean }>()
const states: CoreState[] = [
  "IDLE",
  "LISTENING",
  "THINKING",
  "SPEAKING",
  "WORKING",
]
const healthStates: CoreHealth[] = ["OFFLINE", "CONNECTED", "DEGRADED", "ERROR"]
const healthLabels = { OFFLINE: "Assistant not connected", CONNECTED: "Preview · Connected", DEGRADED: "Preview · Connection warning", ERROR: "Preview · Connection error" }
const navigation = [
  { title: "Home", path: "/", icon: Home },
  { title: "Chat", path: "/chat", icon: MessageSquare },
  { title: "School", path: "/school", icon: BookOpen },
  { title: "Tasks", path: "/tasks", icon: ListChecks },
  { title: "Memory", path: "/memory", icon: Network },
  { title: "System", path: "/system", icon: Cpu },
]
const metadata =
  "font-mono text-[10px] uppercase tracking-[.15em] text-muted-foreground"

function pointOnCircle(radius: number, angle: number, center = 400) {
  return [center + radius * Math.cos(angle), center + radius * Math.sin(angle)]
}
function polygonPoints(count: number, radius: number, phase = 0) {
  return Array.from({ length: count }, (_, index) =>
    pointOnCircle(radius, (index / count) * Math.PI * 2 + phase).join(","),
  ).join(" ")
}

function ringSector(
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number,
) {
  const start = ((startAngle - 90) * Math.PI) / 180
  const end = ((endAngle - 90) * Math.PI) / 180
  const outerStart = pointOnCircle(outerRadius, start)
  const outerEnd = pointOnCircle(outerRadius, end)
  const innerEnd = pointOnCircle(innerRadius, end)
  const innerStart = pointOnCircle(innerRadius, start)
  return `M${outerStart.join(" ")}A${outerRadius} ${outerRadius} 0 0 1 ${outerEnd.join(" ")}L${innerEnd.join(" ")}A${innerRadius} ${innerRadius} 0 0 0 ${innerStart.join(" ")}Z`
}

const ringGlyphs = [
  "M-7 7V-7L0 2L7-7V7M0 2V9",
  "M-6-6Q3-11 6-3Q8 4 0 6Q-7 8-6 1M0-4V10",
  "M-7 6L0-8L7 6ZM-3 2H3M0 6V10",
  "M-6-7Q0-1-6 6M6-7Q0-1 6 6M-5 0H5M0 0V9",
  "M-7-7H7L0 0L7 7H-7M-2 0H3",
  "M-6-7V2Q-6 9 0 8Q6 9 6 2V-7M0-8V10",
  "M-7-6H3L7-2L0 3V9M-3-2H5",
  "M-6 7V-7H6V7ZM-3-3H3V3H-3ZM0 7V10",
  "M-7 5L0-7L7 5M-7 5H7M-3 0H3M0 5V9",
  "M-7-5Q0-11 7-5L0 1L7 7M0 1L-7 7",
  "M-7-7L0 0L7-7M0 0V8M-5 5H5",
  "M-6-7H3L6-3L3 1H-6V7H6M0-7V1",
]


function AstrolabeRings({ motion, state }: { motion: string; state: CoreState }) {
  return (
    <g data-ring="4-knowledge">
      <g
        className={`origin-center animate-[orbit_240s_linear_infinite] ${motion}`}
        stroke="currentColor"
      >
        <circle
          cx="400"
          cy="400"
          r="289"
          strokeOpacity=".12"
          strokeWidth=".5"
        />
        <circle
          cx="400"
          cy="400"
          r="282"
          strokeOpacity=".32"
          strokeWidth=".7"
        />
        <circle
          cx="400"
          cy="400"
          r="272"
          strokeOpacity=".24"
          strokeWidth=".6"
        />
        {Array.from({ length: 72 }, (_, index) => (
          <path
            key={index}
            d={index % 6 === 0 ? "M400 115V126" : "M400 117V122"}
            transform={`rotate(${index * 5} 400 400)`}
            stroke={index % 24 === 0 ? "var(--accent)" : "currentColor"}
            strokeWidth={index % 6 === 0 ? 0.8 : 0.5}
            opacity={index % 6 === 0 ? 0.62 : 0.28}
          />
        ))}
        <circle
          cx="400"
          cy="400"
          r="267"
          stroke="var(--accent)"
          strokeOpacity=".22"
          strokeWidth=".7"
        />
        <circle
          cx="400"
          cy="400"
          r="253"
          strokeOpacity=".34"
          strokeWidth=".65"
        />
        {Array.from({ length: 36 }, (_, index) => (
          <g
            key={index}
            transform={`rotate(${(index * 360) / 36} 400 400) translate(400 140)`}
            opacity={index % 9 === 0 ? 0.65 : 0.34}
            stroke="var(--accent)"
            strokeWidth=".7"
          >
            <path
              d={
                index % 3 === 0
                  ? "M-3 1Q0-4 3 1M0-2V3"
                  : index % 3 === 1
                    ? "M-3-2V2H2V-1H-1"
                    : "M-3 1L0-2L3 1M1-1V3"
              }
            />
          </g>
        ))}
      </g>
      <g
        className={`origin-center animate-[orbit_190s_linear_infinite_reverse] ${motion}`}
        data-knowledge-band
      >
        <circle
          cx="400"
          cy="400"
          r="249"
          stroke="var(--accent)"
          strokeOpacity=".52"
          strokeWidth=".8"
        />
        <circle
          cx="400"
          cy="400"
          r="217"
          stroke="var(--accent)"
          strokeOpacity=".48"
          strokeWidth=".8"
        />
        {Array.from({ length: 12 }, (_, index) => {
          const symbolDelay = state === "LISTENING"
            ? index * 180
            : state === "THINKING"
              ? -index * 300
              : state === "WORKING"
                ? (index % 4) * 180
                : state === "IDLE"
                  ? index * 120
                  : 0
          const anchor = index % 4 === 0

          return (
            <g
              key={index}
              className="ciel-symbol-sector"
              data-symbol-index={index}
              style={{ animationDelay: String(symbolDelay) + "ms" }}
              aria-hidden="true"
              pointerEvents="none"
            >
              <g className="ciel-symbol-content">
              <path
                className="ciel-symbol-tile"
                d={ringSector(217, 249, index * 30 - 13, index * 30 + 13)}
                fill={anchor ? "var(--foreground)" : "var(--primary)"}
                fillOpacity={anchor ? 0.56 : 0.025}
                stroke="var(--accent)"
                strokeOpacity=".22"
                strokeWidth=".55"
              />
              <g
                className="ciel-symbol-glyph"
                transform={`rotate(${index * 30} 400 400) translate(400 167)`}
                stroke={anchor ? "var(--background)" : "var(--primary)"}
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={anchor ? 0.94 : 0.62}
              >
                <path d={ringGlyphs[index % ringGlyphs.length]} />
                <circle
                  cx="0"
                  cy="13"
                  r=".8"
                  fill="currentColor"
                  stroke="none"
                />
              </g>
              </g>
            </g>
          )
        })}
        <circle
          cx="400"
          cy="400"
          r="213"
          stroke="currentColor"
          strokeOpacity=".3"
          strokeWidth=".6"
        />
        <circle
          cx="400"
          cy="400"
          r="194"
          stroke="currentColor"
          strokeOpacity=".28"
          strokeWidth=".7"
        />
        {[198, 204, 210].map((radius, band) => (
          <g key={radius}>
            {Array.from({ length: 120 }, (_, index) => (
              <g
                key={index}
                transform={`rotate(${index * 3 + band * 1.5} 400 400) translate(400 ${400 - radius})`}
                stroke={band === 1 ? "var(--accent)" : "currentColor"}
                strokeWidth=".55"
                opacity={band === 1 ? 0.45 : 0.24}
              >
                <path
                  d={
                    index % 4 === 0
                      ? "M-2 1V-1H1V1H-1M2-1V1"
                      : index % 4 === 1
                        ? "M-2 1L0-1L2 1M0 0V2"
                        : index % 4 === 2
                          ? "M-2-1Q0 2 2-1M-1 0V2"
                          : "M-2 1H1V-1H-1M2 0V2"
                  }
                />
              </g>
            ))}
          </g>
        ))}
        <circle
          cx="400"
          cy="400"
          r="249"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeOpacity=".65"
          strokeDasharray="52 1513"
          transform="rotate(-38 400 400)"
        />
      </g>
      <g
        className={`origin-center animate-[orbit_300s_linear_infinite] ${motion}`}
        stroke="currentColor"
      >
        <circle cx="400" cy="400" r="190" strokeOpacity=".2" strokeWidth=".5" />
        <circle
          cx="400"
          cy="400"
          r="168"
          strokeOpacity=".2"
          strokeWidth=".65"
        />
        {Array.from({ length: 12 }, (_, index) => (
          <g
            key={index}
            transform={`rotate(${index * 30 + 12} 400 400) translate(400 221)`}
            strokeWidth=".8"
            opacity={index % 3 === 0 ? 0.85 : 0.55}
          >
            <path
              d={
                index % 3 === 0
                  ? "M-12 3L-5-7L4-3L12 6"
                  : index % 3 === 1
                    ? "M-11-5L-2 5L5-3L12 1"
                    : "M-11 4L-5-5L5-7L11 5L-11 4"
              }
            />
            {(index % 3 === 0
              ? [
                  [-12, 3],
                  [-5, -7],
                  [4, -3],
                  [12, 6],
                ]
              : index % 3 === 1
                ? [
                    [-11, -5],
                    [-2, 5],
                    [5, -3],
                    [12, 1],
                  ]
                : [
                    [-11, 4],
                    [-5, -5],
                    [5, -7],
                    [11, 5],
                  ]
            ).map(([horizontal, vertical], node) => (
              <circle
                key={node}
                cx={horizontal}
                cy={vertical}
                r="1.5"
                fill={index % 4 === 0 ? "var(--accent)" : "var(--primary)"}
                stroke="none"
              />
            ))}
          </g>
        ))}
      </g>
    </g>
  )
}

function CielCore({ state, motionEnabled, compact = false, interactive = false, activeRing = null, selectedRing = null, health = "OFFLINE", notification = false, onRingPreview = () => {}, onRingSelect = () => {} }: { state: CoreState; motionEnabled?: boolean; compact?: boolean; interactive?: boolean; activeRing?: string | null; selectedRing?: string | null; health?: CoreHealth; notification?: boolean; onRingPreview?: (name: string | null) => void; onRingSelect?: (name: string) => void }) {
  const previewRing = [conversationWorkspace, ...ringWorkspaces].find((ring) => ring.name === activeRing)
  const [calloutHorizontal, calloutVertical] = pointOnCircle((previewRing?.radius ?? 233) * 1.035, -Math.PI / 6)

  const energyMotion = ""
  const motion = ""
  const reasoningMotion = motion
  const contextMotion = motion
  const boundaryMotion = motion
  const tone = "text-primary"
  const coreRef = useRef<HTMLDivElement>(null)
  const phases = useRef(new WeakMap<Element, { phase: number; rate: number }>())
  useLayoutEffect(() => {
    const core = coreRef.current
    if (!core) return
    const elements = Array.from(core.querySelectorAll("*"))
    const animations = core.getAnimations({ subtree: true }).filter((animation): animation is CSSAnimation => animation instanceof CSSAnimation)
    const tracked = animations.map((animation) => {
      const effect = animation.effect as KeyframeEffect
      const key = `${elements.indexOf(effect.target!)}:${animation.animationName}`
      const duration = Number(effect.getTiming().duration)
      const previous = coreMotionPhases.get(key)
      if (previous && duration > 0) {
        const elapsed = animation.playState === "paused" || !previous.running ? 0 : performance.now() - previous.time
        animation.currentTime = previous.phase * duration + elapsed * previous.rate
        animation.updatePlaybackRate(previous.rate)
      }
      return { animation, key, duration }
    })
    return () => {
      for (const { animation, key, duration } of tracked) {
        if (animation.currentTime === null || duration <= 0) continue
        coreMotionPhases.set(key, {
          phase: Number(animation.currentTime) % duration / duration,
          rate: animation.playbackRate,
          running: animation.playState !== "paused",
          time: performance.now(),
        })
      }
    }
  }, [])
  useEffect(() => {
    const core = coreRef.current
    if (!core || motionEnabled === false || (motionEnabled === undefined && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) return
    const speed = { IDLE: 1, LISTENING: 1.3, THINKING: 3.5, SPEAKING: 1.8, WORKING: 2.5 }[state]
    const pulseDuration = { IDLE: 8, LISTENING: 3.2, THINKING: 2.8, SPEAKING: 2.4, WORKING: 4 }[state]
    const animations = core.getAnimations({ subtree: true }).filter((animation): animation is CSSAnimation => animation instanceof CSSAnimation)
    const tracked = animations.map((animation) => {
      const effect = animation.effect as KeyframeEffect
      const target = effect.target
      const part = target?.getAttribute("data-core-part")
      const preservePhase = part === "seed" || part === "halo"
      const duration = Number(effect.getTiming().duration)
      const previous = target && preservePhase ? phases.current.get(target) : undefined
      if (previous) {
        animation.currentTime = previous.phase * duration
        animation.updatePlaybackRate(previous.rate)
      }
      return { animation, target, preservePhase, duration,
        rate: animation.animationName === "orbit"
          ? target?.closest('[data-layer="1-intelligent-energy-nucleus"]') ? speed : Math.min(speed, 1.2)
          : part === "seed" ? 8 / pulseDuration : 1 }
    }).filter((item) => item.animation.animationName === "orbit" || item.preservePhase)
    let frame = 0
    let previousTime: number | undefined
    const tick = (time: number) => {
      const elapsed = previousTime === undefined ? 0 : Math.min((time - previousTime) / 1000, .1)
      previousTime = time
      const blend = 1 - Math.exp(-elapsed / .45)
      for (const item of tracked) {
        const rate = item.animation.playbackRate + (item.rate - item.animation.playbackRate) * blend
        if (Math.abs(item.animation.playbackRate - item.rate) > .005) item.animation.updatePlaybackRate(rate)
        if (item.target && item.preservePhase && item.animation.currentTime !== null) {
          phases.current.set(item.target, { phase: Number(item.animation.currentTime) % item.duration / item.duration, rate })
        }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [state, motionEnabled])
  return (
    <div
      ref={coreRef}
      data-core-state={state.toLowerCase()}
      data-core-compact={compact}
      data-ring-preview={activeRing ?? ""}
      data-ring-selected={selectedRing ?? ""}
      data-core-health={health.toLowerCase()}
      data-motion={motionEnabled === undefined ? "system" : motionEnabled ? "on" : "off"}
      className={`pointer-events-none relative aspect-square w-full transition-all duration-1000 ${tone}`}
    >
      <svg
        viewBox={compact ? "235 235 330 330" : "0 0 800 800"}
        className="h-full w-full overflow-visible"
        fill="none"
        role={interactive ? "group" : "img"}
        aria-label={`CIEL Core with six functional rings: ${state.toLowerCase()}`}
      >
        <defs>
          <radialGradient id="core-atmosphere">
            <stop stopColor="var(--core-energy, #79baff)" stopOpacity=".14" />
            <stop offset=".45" stopColor="#416da8" stopOpacity=".04" />
            <stop offset="1" stopColor="#0b1528" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="core-bloom">
            <stop stopColor="#effaff" stopOpacity=".9" />
            <stop offset=".17" stopColor="var(--core-energy, #b2e7ff)" stopOpacity=".48" />
            <stop offset=".42" stopColor="var(--core-energy, #6bbdff)" stopOpacity=".13" />
            <stop offset=".7" stopColor="var(--core-energy, #4386c8)" stopOpacity=".035" />
            <stop offset="1" stopColor="#528ebf" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="core-seed" cx=".5" cy=".5">
            <stop stopColor="#ffffff" />
            <stop offset=".43" stopColor="#eefaff" />
            <stop offset=".75" stopColor="var(--core-energy, #b0e2ff)" />
            <stop offset="1" stopColor="var(--core-energy, #8ed5ff)" stopOpacity=".12" />
          </radialGradient>
          <linearGradient id="ring-light" x1="0" y1="1" x2="1" y2="0">
            <stop stopColor="#8ecafa" stopOpacity=".08" />
            <stop offset=".42" stopColor="#b6e8ff" stopOpacity=".45" />
            <stop offset=".66" stopColor="#effaff" stopOpacity=".82" />
            <stop offset="1" stopColor="#71b7f3" stopOpacity=".08" />
          </linearGradient>
          <filter id="soft-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="2" />
          </filter>
          <filter id="seed-glow" x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur stdDeviation="15" />
          </filter>
          <filter
            id="energy-texture"
            x="-40%"
            y="-40%"
            width="180%"
            height="180%"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency=".035"
              numOctaves="3"
              seed="17"
              result="texture"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="texture"
              scale="7"
              xChannelSelector="R"
              yChannelSelector="G"
            />
            <feColorMatrix in="texture" type="saturate" values="0" />
            <feComposite in2="SourceGraphic" operator="in" />
            <feBlend in2="SourceGraphic" mode="screen" />
          </filter>
        </defs>
        <circle className="ciel-core-atmosphere" cx="400" cy="400" r="386" fill="url(#core-atmosphere)" />
        <g
          data-ring="6-boundary"
          stroke="currentColor"
          strokeWidth=".6"
        >
          <circle
            cx="400"
            cy="400"
            r="330"
            strokeOpacity=".12"
            strokeDasharray="160 75 45 150 240 110 85 330"
            transform="rotate(-77 400 400)"
          />
          <circle
            cx="400"
            cy="400"
            r="312"
            strokeOpacity=".065"
            strokeDasharray="320 80 100 210"
          />
          <polygon
            points={polygonPoints(8, 346, Math.PI / 8)}
            strokeOpacity=".055"
            strokeDasharray="76 28 10 38"
          />
          <ellipse
            cx="400"
            cy="400"
            rx="348"
            ry="284"
            transform="rotate(-19 400 400)"
            strokeOpacity=".07"
            strokeDasharray="270 200 150 450"
          />
          <path
            d="M153 185h38l20 20M604 174h25v31M638 612h-34l-15-15M163 596v26h37"
            strokeOpacity=".18"
          />
          <path
            d="M97 391v18M92 400h10M701 391v18M696 400h10"
            strokeOpacity=".22"
          />
          <g
            className={`origin-center animate-[orbit_480s_linear_infinite_reverse] ${boundaryMotion}`}
            stroke="currentColor"
          >
            <circle cx="400" cy="400" r="366" strokeOpacity=".2" strokeWidth=".6" />
            {Array.from({ length: 72 }, (_, index) => (
              <path
                key={index}
                d={index % 6 === 0 ? "M400 29V41" : "M400 30V35"}
                transform={`rotate(${index * 5} 400 400)`}
                stroke={state === "LISTENING" && index < 12 ? "var(--accent)" : "currentColor"}
                strokeOpacity={index % 6 === 0 ? 0.55 : 0.25}
                strokeWidth={index % 6 === 0 ? 0.8 : 0.5}
              />
            ))}
          </g>
          <g fill="#d1bd91" stroke="none">
            <circle cx="165" cy="173" r="1.4" opacity=".7" />
            <circle cx="652" cy="581" r="1.4" opacity=".7" />
          </g>
        </g>
        <g
          data-ring="5-capability"
          data-capability-band
          className={`origin-center animate-[orbit_280s_linear_infinite] ${motion}`}
        >
          {Array.from({ length: 8 }, (_, index) => (
            <path key={index} d={ringSector(294, 301, index * 45 - 19, index * 45 + 19)}
              fill="var(--primary)" fillOpacity=".07" stroke="currentColor" strokeOpacity=".32" strokeWidth=".65" />
          ))}
          {[15, 112, 193, 264, 327].map((angle, index) => (
            <g
              key={angle}
              transform={`rotate(${angle} 400 400)`}
              stroke="currentColor"
              strokeWidth=".65"
              opacity=".24"
            >
              <path
                d={
                  index % 2
                    ? "M400 140v26l11 11v21h-5"
                    : "M400 101v18l-10 10v23h8"
                }
              />
              <rect x="397" y={index % 2 ? 134 : 95} width="6" height="6" />
            </g>
          ))}
        </g>
        <AstrolabeRings motion={motion} state={state} />
        <g
          data-ring="2-context"
          className={`origin-center animate-[orbit_120s_linear_infinite] ${contextMotion}`}
        >
          <circle
            cx="400"
            cy="400"
            r="164"
            stroke="currentColor"
            strokeOpacity=".3"
            strokeWidth=".55"
            strokeDasharray="165 34 53 46 245 85"
          />
          <circle
            cx="400"
            cy="400"
            r="171"
            stroke="currentColor"
            strokeOpacity=".1"
            strokeWidth=".5"
            strokeDasharray="56 76 190 55"
          />
          <circle
            cx="400"
            cy="400"
            r="157"
            stroke="currentColor"
            strokeOpacity=".45"
            strokeWidth="1"
            strokeDasharray="47 940"
            transform="rotate(58 400 400)"
          />
          {Array.from({ length: 12 }, (_, index) => {
            const [horizontal, vertical] = pointOnCircle(
              164,
              (index * Math.PI) / 6 + 0.17,
            )
            const gold = index === 2 || index === 7
            const listening = state === "LISTENING" && index === 0
            return (
              <g key={index}>
                <circle
                  cx={horizontal}
                  cy={vertical}
                  r="5"
                  fill={gold ? "#d1bd91" : "currentColor"}
                  opacity={listening || gold ? 0.7 : 0.32}
                  filter="url(#soft-glow)"
                />
                <circle
                  cx={horizontal}
                  cy={vertical}
                  r={listening ? 2.8 : gold ? 2.4 : 1.7}
                  fill={listening ? "#ffffff" : gold ? "#e4d2ac" : "#e6f6ff"}
                />
                {index % 3 === 0 && (
                  <path
                    d={`M${horizontal - 5} ${vertical - 8}h10m-10 16h10`}
                    stroke="currentColor"
                    strokeOpacity=".35"
                    strokeWidth=".6"
                  />
                )}
              </g>
            )
          })}
          <path
            d="M230 382v-28l18-18h17M574 440v20l-19 19h-22"
            stroke="currentColor"
            strokeOpacity=".23"
            strokeWidth=".65"
          />
        </g>
        <g
          data-ring="3-reasoning"
          className={`origin-center animate-[orbit_120s_linear_infinite_reverse] ${reasoningMotion}`}
          stroke="currentColor"
          fill="none"
        >
          <circle cx="400" cy="400" r="198" strokeWidth="1.4" strokeOpacity=".55" strokeDasharray="82 34 46 969" />
          <circle cx="400" cy="400" r="205" strokeWidth="1" strokeOpacity=".32" strokeDasharray="154 1021" transform="rotate(32 400 400)" />
          <circle cx="400" cy="400" r="190" strokeWidth=".8" strokeOpacity=".24" strokeDasharray="45 28 71 944" transform="rotate(146 400 400)" />
        </g>
        <g
          data-ring="1-cognition"
          className={`animate-[breathe_7s_ease-in-out_infinite] ${motion}`}
          stroke="currentColor"
          strokeWidth=".7"
        >
          <path
            d="M400 263L519 331L519 469L400 537L281 469L281 331ZM400 263L519 469L281 331L519 331L400 537L281 469L400 263M281 331L400 537M281 469L519 331"
            strokeOpacity=".4"
          />
          <path
            d="M345 305L510 400L345 495L290 400L455 305L455 495ZM345 305L455 495M455 305L345 495M290 400H510"
            strokeOpacity=".18"
          />
          {[
            [400, 263],
            [519, 331],
            [519, 469],
            [400, 537],
            [281, 469],
            [281, 331],
          ].map(([horizontal, vertical], index) => (
            <g key={index}>
              <circle
                cx={horizontal}
                cy={vertical}
                r="2"
                fill="var(--primary)"
                stroke="none"
              />
              <circle
                cx={horizontal}
                cy={vertical}
                r="5"
                strokeOpacity=".15"
                strokeWidth=".5"
              />
            </g>
          ))}
        </g>
        <g data-layer="1-intelligent-energy-nucleus">
          <circle className="ciel-thinking-scan" cx="400" cy="400" r="100" fill="none" stroke="var(--primary)" strokeWidth="1.1" strokeDasharray="45 583" />
          <g
            data-core-part="listening-inflow"
            className={`transition-opacity duration-700 ${state === "LISTENING" || state === "SPEAKING" ? "opacity-100" : "opacity-0"}`}
            stroke="var(--primary)"
            fill="none"
          >
            <g className="ciel-listening-cue">
            {[0, 1].map((index) => (
              <circle
                key={index}
                cx="400"
                cy="400"
                r="112"
                strokeWidth=".8"
                className="ciel-listening-inflow"
                style={{ animationDelay: `${index * -2}s` }}
              />
            ))}
            </g>
            <g className="ciel-speaking-cue">
              {[0, 1].map((index) => <circle key={index} cx="400" cy="400" r="112" strokeWidth=".8"
                className="ciel-speaking-outflow" style={{ animationDelay: `${index * -1.6}s` }} />)}
            </g>
          </g>
          <circle
            cx="400"
            cy="400"
            r="168"
            fill="url(#core-bloom)"
            opacity=".65"
            data-core-part="halo"
          />
          <g
            className={`origin-center animate-[orbit_135s_linear_infinite] ${motion}`}
          >
            {Array.from({ length: 42 }, (_, index) => {
              const angle = (index * Math.PI * 2) / 42 + 0.03
              const inner = pointOnCircle(22 + ((index * 7) % 18), angle)
              const outer = pointOnCircle(102 + ((index * 17) % 66), angle)
              return (
                <g key={index}>
                  <path
                    d={`M${inner.join(" ")}L${outer.join(" ")}`}
                    stroke="var(--primary)"
                    strokeWidth={index % 7 === 0 ? 0.9 : 0.45}
                    strokeOpacity={index % 7 === 0 ? 0.65 : 0.22}
                  />
                </g>
              )
            })}
          </g>
          <g
            className={`transition-opacity duration-[1800ms] ${
              state === "SPEAKING" || state === "WORKING"
                ? "opacity-80"
                : "opacity-0"
            }`}
            stroke="var(--accent)"
            fill="none"
          >
            <path
              d="M400 254L546 400L400 546L254 400Z"
              strokeWidth=".9"
              strokeOpacity=".6"
            />
            <path
              d="M400 270L530 400L400 530L270 400Z"
              strokeWidth=".5"
              strokeOpacity=".25"
            />
            <circle
              cx="400"
              cy="400"
              r="116"
              strokeWidth="1.2"
              strokeOpacity=".5"
              strokeDasharray="102 47 146 89"
              className={`origin-center animate-[orbit_44s_linear_infinite] ${energyMotion}`}
            />
            {[0, 90, 180, 270].map((angle) => (
              <path
                key={angle}
                d="M400 258V283"
                transform={`rotate(${angle} 400 400)`}
                strokeWidth="1.4"
                strokeOpacity=".7"
              />
            ))}
          </g>
          <g
            data-core-part="seed"
            className="origin-center animate-[ciel-pulse_6s_ease-in-out_infinite]"
          >
            <circle
              cx="400"
              cy="400"
              r="37"
              fill="var(--core-energy, #c7f0ff)"
              opacity=".8"
              filter="url(#seed-glow)"
            />
            <circle
              cx="400"
              cy="400"
              r="47"
              fill="url(#core-seed)"
              opacity=".65"
            />
            {Array.from({ length: 28 }, (_, index) => {
              const angle = (index * Math.PI * 2) / 28
              const inner = pointOnCircle(9, angle)
              const outer = pointOnCircle(33 + ((index * 11) % 30), angle)
              return (
                <path
                  key={index}
                  d={`M${inner.join(" ")}L${outer.join(" ")}`}
                  stroke="var(--core-energy, #eefaff)"
                  strokeWidth={index % 4 === 0 ? 1 : 0.55}
                  strokeOpacity={index % 4 === 0 ? 0.8 : 0.45}
                />
              )
            })}
            <circle
              cx="400"
              cy="400"
              r="27"
              fill="url(#core-seed)"
              filter="url(#soft-glow)"
            />
            <circle
              cx="400"
              cy="400"
              r="17"
              fill="#ffffff"
              opacity=".9"
              filter="url(#soft-glow)"
            />
            <circle cx="400" cy="400" r="10" fill="#f9fdff" />
          </g>
        </g>
        {interactive && (
          <g aria-label="Ring navigation">
            <g aria-hidden="true" pointerEvents="none">
            {ringWorkspaces.map((ring) => <g key={ring.name} className="ciel-ring-guide" data-name={ring.name} data-active={activeRing === ring.name} data-selected={selectedRing === ring.name}>
              <circle className="ciel-ring-outline" cx="400" cy="400" r={ring.radius + ring.width / 2} fill="none" stroke="currentColor" />
              <circle className="ciel-ring-edge" cx="400" cy="400" r={ring.radius - ring.width / 2} fill="none" stroke="currentColor" />
            </g>)}
          </g>
          <NavLink to={conversationWorkspace.path} className="ciel-core-link pointer-events-auto"
            onPointerEnter={() => onRingPreview(conversationWorkspace.name)}
            onPointerLeave={() => onRingPreview(null)}
            onFocus={() => onRingPreview(conversationWorkspace.name)}
            onBlur={() => onRingPreview(null)}
            aria-label="Open Conversation from the Core">
            <title>Core → Conversation</title>
            <circle className="ciel-core-hit-area" cx="400" cy="400" r="72" fill="transparent" stroke="transparent" pointerEvents="all" />
          </NavLink>
          {ringWorkspaces.map((ring, index) => (
              <NavLink key={ring.name} to={ring.path} className="ciel-ring-link pointer-events-auto"
                onPointerEnter={() => onRingPreview(ring.name)}
                onPointerLeave={() => onRingPreview(null)}
                onFocus={() => onRingPreview(ring.name)}
                onBlur={() => onRingPreview(null)}
                onClick={(event) => {
                  if (event.detail > 0 && window.matchMedia("(hover: none), (max-width: 767px)").matches) {
                    event.preventDefault()
                    onRingSelect(ring.name)
                  }
                }}
                aria-label={`Open ${ring.title} — Ring ${index + 1}`}>
                <title>Ring {index + 1} → {ring.title}</title>
                <circle className="ciel-pointer-target" cx="400" cy="400" r={ring.radius} fill="none"
                  stroke="transparent" strokeWidth={ring.width} pointerEvents="stroke" />
                <circle className="ciel-touch-target" cx="400" cy="400" r={ring.radius} fill="none" stroke="transparent"
                  strokeWidth={Math.max(ring.width, Math.min(
                    index === 0 ? 48 : ring.radius - ringWorkspaces[index - 1].radius,
                    index === ringWorkspaces.length - 1 ? 48 : ringWorkspaces[index + 1].radius - ring.radius,
                  ) - 2)} pointerEvents="stroke" />
              </NavLink>
            ))}
          </g>
        )}
        {!compact && <g aria-hidden="true" pointerEvents="none">
          <circle className="ciel-health-marker" cx="698" cy="190" r="4" />
          {notification && (
            <g className="ciel-notification-marker">
              <circle className="ciel-notification-pulse" cx="712" cy="205" r="5.5" fill="none" stroke="#f2d590" strokeWidth="1.1" />
              <circle className="ciel-notification-pulse" cx="712" cy="205" r="5.5" fill="none" stroke="#f2d590" strokeWidth="1.1" style={{ animationDelay: "-1.2s" }} />
              <circle cx="712" cy="205" r="8" fill="none" stroke="#f2d590" strokeWidth="1" strokeOpacity=".9" />
              <circle cx="712" cy="205" r="3.5" fill="#f2d590" />
              <text className="ciel-notification-label" x="725" y="208">NEW</text>
            </g>
          )}
        </g>}
        {interactive && <g className="ciel-ring-callout" data-visible={Boolean(previewRing)} aria-hidden="true" pointerEvents="none">
          <circle cx={calloutHorizontal} cy={calloutVertical} r="2.5" fill="var(--accent)" />
          <path d={`M${calloutHorizontal} ${calloutVertical}H${Math.max(calloutHorizontal + 12, 690)}l24-24H790`}
            stroke="var(--primary)" strokeOpacity=".65" strokeWidth="1" pathLength="1" />
          <text x="790" y={calloutVertical - 36} textAnchor="end" fill="var(--primary)">
            {previewRing && `Open ${previewRing.title}`}
          </text>
        </g>}
      </svg>
    </div>
  )
}
function Environment() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_43%,#11244065_0%,#080f1c35_34%,transparent_67%)]" />
      <div className="absolute bottom-0 left-[25%] h-[40%] w-[65%] bg-[radial-gradient(ellipse_at_bottom,#142a4530,transparent_65%)]" />
      <svg
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 1440 900"
      >
        <defs>
          <linearGradient id="grid-fade" x2="0" y2="1">
            <stop stopColor="#729ed1" stopOpacity="0" />
            <stop offset=".5" stopColor="#729ed1" stopOpacity=".035" />
            <stop offset="1" stopColor="#729ed1" stopOpacity="0" />
          </linearGradient>
        </defs>
        {Array.from({ length: 90 }, (_, index) => (
          <circle
            key={index}
            cx={(index * 127.71) % 1440}
            cy={(index * 71.31) % 900}
            r={index % 11 === 0 ? 1.3 : index % 4 === 0 ? 0.8 : 0.45}
            fill="#c8e6ff"
            opacity={index % 11 === 0 ? 0.38 : 0.11}
          />
        ))}
        <g stroke="url(#grid-fade)" strokeWidth=".6">
          {[200, 360, 520, 680, 840, 1000, 1160, 1320].map((horizontal) => (
            <path key={horizontal} d={`M${horizontal} 160V820`} />
          ))}
          {[260, 420, 580, 740].map((vertical) => (
            <path key={vertical} d={`M130 ${vertical}H1440`} />
          ))}
        </g>
        <g stroke="#9bc7f1" strokeWidth=".5" opacity=".035">
          {Array.from({ length: 22 }, (_, index) => {
            const angle = (index * Math.PI * 2) / 22 + 0.1
            return (
              <path
                key={index}
                d={`M${720 + Math.cos(angle) * 305} ${414 + Math.sin(angle) * 305}L${720 + Math.cos(angle) * 600} ${414 + Math.sin(angle) * 600}`}
              />
            )
          })}
        </g>
        <g stroke="#b5e8ff" strokeWidth=".6" opacity=".14">
          <path d="M1083 316h29l13-13h32M1082 580h22l13-13h35" />
          <circle cx="1083" cy="316" r="2" fill="#d1bd91" stroke="none" />
          <circle cx="1082" cy="580" r="1.5" fill="#b5e8ff" stroke="none" />
        </g>
        <g
          className="motion-safe:animate-[ciel-drift_19s_ease-in-out_infinite]"
          fill="#d9efff"
        >
          {[
            [502, 275, 1.8],
            [1017, 501, 2.1],
            [629, 665, 1.1],
            [887, 164, 1.2],
            [1090, 665, 1.4],
          ].map(([horizontal, vertical, radius], index) => (
            <g key={index}>
              <circle
                cx={horizontal}
                cy={vertical}
                r={radius * 3}
                opacity=".025"
              />
              <circle cx={horizontal} cy={vertical} r={radius} opacity=".22" />
            </g>
          ))}
        </g>
        <path
          d="M340 124l7-4 7 4v8l-7 4-7-4zM1271 724l9-5 9 5v10l-9 5-9-5zM1121 167l7 5v9l-7 4-7-4v-9zM394 638l9-6 12 7v12l-12 7-9-7z"
          stroke="#a1c4e5"
          strokeWidth=".5"
          opacity=".12"
        />
      </svg>
    </div>
  )
}

function Shell() {
  const location = useLocation()
  const navigate = useNavigate()
  const ringMenuRef = useRef<HTMLDialogElement>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const coreTravel = useRef<Animation | null>(null)
  const travelSource = useRef<DOMRect | null>(null)
  const [motionPreference, setMotionPreference] = useState(readMotionPreference)
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  const motionEnabled = motionPreference === null ? !reducedMotion : motionPreference === "on"
  const [state, setState] = useState<CoreState>("IDLE")
  const [health, setHealth] = useState<CoreHealth>("OFFLINE")
  const [notification, setNotification] = useState(false)
  const [restoredWorkspace] = useState(readLocalWorkspace)
  const [chatDraft, setChatDraft] = useState(restoredWorkspace.data.chatDraft)
  const [chatMessages, setChatMessages] = useState(restoredWorkspace.data.chatMessages)
  const [contextItems, setContextItems] = useState(restoredWorkspace.data.contextItems)
  const [planGoal, setPlanGoal] = useState(restoredWorkspace.data.planGoal)
  const [planSteps, setPlanSteps] = useState(restoredWorkspace.data.planSteps)
  const [automationDrafts, setAutomationDrafts] = useState(restoredWorkspace.data.automationDrafts)
  const [preferences, setPreferences] = useState(restoredWorkspace.data.preferences)
  const [referenceNotes, setReferenceNotes] = useState(restoredWorkspace.data.referenceNotes)
  const [editorDrafts, setEditorDrafts] = useState(restoredWorkspace.data.editorDrafts)
  const [localSavingIssue, setLocalSavingIssue] = useState(restoredWorkspace.issue)
  const [locallySaved, setLocallySaved] = useState(false)
  const localSavingAllowed = useRef(!restoredWorkspace.issue)
  const lastSavedWorkspace = useRef(restoredWorkspace.saved)
  const workspaceData = useMemo(() => ({ chatDraft, chatMessages, contextItems, planGoal, planSteps, automationDrafts, preferences, referenceNotes, editorDrafts }), [chatDraft, chatMessages, contextItems, planGoal, planSteps, automationDrafts, preferences, referenceNotes, editorDrafts])
  const latestWorkspace = useRef(workspaceData)
  useLayoutEffect(() => { latestWorkspace.current = workspaceData }, [workspaceData])
  const retryLocalSaving = () => {
    if (!localSavingAllowed.current) return
    const result = saveLocalWorkspace(latestWorkspace.current, lastSavedWorkspace.current)
    lastSavedWorkspace.current = result.saved
    if (result.blocked) localSavingAllowed.current = false
    setLocalSavingIssue(result.issue)
    setLocallySaved(!result.issue)
  }
  useEffect(() => {
    setLocallySaved(false)
    const timer = setTimeout(retryLocalSaving, 250)
    return () => clearTimeout(timer)
  }, [workspaceData])
  useEffect(() => {
    const flushWhenHidden = () => { if (document.visibilityState === "hidden") retryLocalSaving() }
    window.addEventListener("pagehide", retryLocalSaving)
    document.addEventListener("visibilitychange", flushWhenHidden)
    return () => { window.removeEventListener("pagehide", retryLocalSaving); document.removeEventListener("visibilitychange", flushWhenHidden) }
  }, [])
  const downloadLocalBackup = (stored = false) => {
    try {
      const saved = stored ? localStorage.getItem(workspaceStorageKey) : serializeWorkspace(latestWorkspace.current)
      if (saved === null) { setLocalSavingIssue("There is no stored copy to download. You can still download a backup of this tab's current workspace."); return }
      const url = URL.createObjectURL(new Blob([saved], { type: "application/json" }))
      const link = document.createElement("a")
      link.href = url; link.download = stored ? "ciel-stored-copy.json" : "ciel-local-backup.json"; link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch { setLocalSavingIssue("The backup could not be downloaded. Your current changes are still in this tab.") }
  }
  const applyWorkspace = (data: WorkspaceData) => {
    setChatDraft(data.chatDraft); setChatMessages(data.chatMessages); setContextItems(data.contextItems)
    setPlanGoal(data.planGoal); setPlanSteps(data.planSteps); setAutomationDrafts(data.automationDrafts)
    setPreferences(data.preferences); setReferenceNotes(data.referenceNotes); setEditorDrafts(data.editorDrafts)
    latestWorkspace.current = data
  }
  const restoreLocalBackup = (data: WorkspaceData) => {
    const result = saveLocalWorkspace(data, lastSavedWorkspace.current)
    if (result.issue) return result.issue
    lastSavedWorkspace.current = result.saved
    localSavingAllowed.current = true
    applyWorkspace(data)
    setLocalSavingIssue(""); setLocallySaved(true)
    return ""
  }
  const resetLocalWorkspace = () => {
    if (!window.confirm("Remove this browser's saved CIEL messages, context, plans, workflow drafts, notes, and draft settings? Download a backup first if you need them.")) return
    try {
      localStorage.removeItem(workspaceStorageKey)
      lastSavedWorkspace.current = null
      applyWorkspace(emptyWorkspace())
      localSavingAllowed.current = true
      setLocalSavingIssue("")
    } catch { setLocalSavingIssue("Browser data could not be removed. Your current workspace has been kept.") }
  }
  const localSaveStatus = localSavingIssue ? "Local saving needs attention" : locallySaved ? "Saved locally" : "Saving locally…"
  const setMotionEnabled = (enabled: boolean) => {
    try { localStorage.setItem("ciel-motion", enabled ? "on" : "off") }
    catch { setLocalSavingIssue("Your animation choice could not be saved in this browser. It still applies in this tab.") }
    setMotionPreference(enabled ? "on" : "off")
  }
  useLayoutEffect(() => {
    const shell = shellRef.current
    if (location.pathname !== "/chat" || !shell) return
    const viewport = window.visualViewport
    const updateViewport = () => {
      shell.style.setProperty("--ciel-chat-height", `${viewport?.height ?? window.innerHeight}px`)
      shell.style.setProperty("--ciel-chat-top", `${viewport?.offsetTop ?? 0}px`)
    }
    viewport?.addEventListener("resize", updateViewport)
    viewport?.addEventListener("scroll", updateViewport)
    window.addEventListener("resize", updateViewport)
    updateViewport()
    return () => {
      viewport?.removeEventListener("resize", updateViewport)
      viewport?.removeEventListener("scroll", updateViewport)
      window.removeEventListener("resize", updateViewport)
      shell.style.removeProperty("--ciel-chat-height")
      shell.style.removeProperty("--ciel-chat-top")
    }
  }, [location.pathname])
  const navigateWithCoreTransition = (path: string) => {
    const reducedMotion = !motionEnabled
    const source = document.querySelector<HTMLElement>(path === "/" ? ".ciel-corner-core [data-core-state]" : ".ciel-home [data-core-state]")?.getBoundingClientRect()
    coreTravel.current?.cancel()
    travelSource.current = !reducedMotion && source && path !== location.pathname ? source : null
    navigate(path)
  }
  useLayoutEffect(() => {
    document.querySelector<HTMLElement>(location.pathname === "/" ? ".ciel-home" : ".ciel-workspace h1")?.focus({ preventScroll: true })
    const source = travelSource.current
    travelSource.current = null
    if (!source) return
    const returningHome = location.pathname === "/"
    let frame = 0
    let stopTravel = () => {}
    const startTravel = () => {
      const destination = document.querySelector<HTMLElement>(returningHome ? ".ciel-home [data-core-state]" : ".ciel-corner-core [data-core-state]")
      if (!destination) { frame = requestAnimationFrame(startTravel); return }
      if (!destination.animate) return
      const target = destination.getBoundingClientRect()
      const horizontal = source.left + source.width / 2 - target.left - target.width / 2
      const vertical = source.top + source.height / 2 - target.top - target.height / 2
      const scale = returningHome ? source.width / (target.width * 330 / 800) : source.width * 330 / 800 / target.width
      const animation = destination.animate([
        { transform: `translate(${horizontal}px, ${vertical}px) scale(${scale})` },
        { transform: "translate(0, 0) scale(1)" },
      ], { duration: 760, easing: "cubic-bezier(.22, 1, .36, 1)", fill: "both" })
      coreTravel.current = animation
      const ringAnimations = returningHome ? Array.from(destination.querySelectorAll("[data-ring]:not([data-ring='1-cognition'])")).map((ring) => ring.animate([
        { opacity: 0 },
        { opacity: getComputedStyle(ring).opacity },
      ], { duration: 560, delay: 200, easing: "ease-out", fill: "backwards" })) : []
      destination.dataset.coreTravelling = "true"
      const finish = () => { delete destination.dataset.coreTravelling; animation.cancel() }
      animation.finished.then(finish, () => { delete destination.dataset.coreTravelling })
      stopTravel = () => { animation.cancel(); ringAnimations.forEach((ringAnimation) => ringAnimation.cancel()) }
    }
    startTravel()
    return () => { cancelAnimationFrame(frame); stopTravel() }
  }, [location.pathname])
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)")
    const updateReducedMotion = () => setReducedMotion(preference.matches)
    preference.addEventListener("change", updateReducedMotion)
    updateReducedMotion()
    return () => preference.removeEventListener("change", updateReducedMotion)
  }, [])
  useEffect(() => { if (!motionEnabled) coreTravel.current?.cancel() }, [motionEnabled])
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.isComposing || event.repeat || document.querySelector("dialog[open]")) return
      const target = event.target as HTMLElement
      if (target.closest("input, textarea, select, [contenteditable='true']")) return
      if (event.key === "?" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault()
        if (location.pathname === "/system") document.getElementById("keyboard-shortcuts")?.scrollIntoView({ block: "start", behavior: motionEnabled ? "smooth" : "instant" })
        else navigateWithCoreTransition("/system")
      }
      if (event.altKey && !event.ctrlKey && !event.metaKey && /^[0-6]$/.test(event.key)) {
        event.preventDefault()
        navigateWithCoreTransition(event.key === "0" ? "/" : ringWorkspaces[Number(event.key) - 1].path)
      }
      if (event.altKey && !event.ctrlKey && !event.metaKey && event.code === "KeyC") {
        event.preventDefault()
        navigateWithCoreTransition(conversationWorkspace.path)
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [navigate, location.pathname, motionEnabled])
  return (
    <div ref={shellRef} data-workspace={location.pathname !== "/"} data-conversation={location.pathname === "/chat"} data-density={preferences.density.toLowerCase()}
      onClickCapture={(event) => {
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
        const link = (event.target as Element).closest<HTMLAnchorElement>("a[href]")
        if (!link || link.getAttribute("target") || link.hasAttribute("download")) return
        const destination = new URL(link.getAttribute("href")!, window.location.href)
        if (destination.origin !== window.location.origin || (destination.pathname !== "/" && !workspaces.some((workspace) => workspace.path === destination.pathname))) return
        if (link.classList.contains("ciel-ring-link") && event.detail > 0 && window.matchMedia("(hover: none), (max-width: 767px)").matches) return
        event.preventDefault()
        navigateWithCoreTransition(destination.pathname + destination.search + destination.hash)
      }}
      className="ciel-shell relative isolate min-h-screen bg-background text-foreground lg:h-[100dvh] lg:min-h-0 lg:overflow-hidden">
      <Environment />
      <div className="relative">
        <header className="ciel-header relative z-30 flex h-[76px] items-center justify-between px-6 md:px-12">
          <div className="flex items-center gap-3">
            <button type="button" aria-label="Open ring navigation" aria-haspopup="dialog" aria-controls="ciel-ring-menu"
              className="flex h-11 w-11 items-center justify-center rounded text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
              onClick={() => ringMenuRef.current?.showModal()}><Menu size={19} /></button>
            {location.pathname !== "/" && <NavLink
              to="/"
              aria-label={location.pathname === "/" ? "CIEL Home" : "Return to CIEL Core"}
              className="flex items-center gap-3 font-display text-[27px] font-light tracking-[.24em]"
            >
              <span className="ciel-corner-core shrink-0" aria-hidden="true">
                <CielCore state={state} health={health} notification={notification} compact motionEnabled={motionEnabled} />
              </span>
            </NavLink>}
          </div>
          {localSavingIssue ? <NavLink to="/system" role="alert" className="max-w-[48%] text-xs text-[#ff8995]">Local saving needs attention · Settings</NavLink> : location.pathname !== "/" && <span className="ciel-mini-status" role="status" data-health={health.toLowerCase()}>
            <span className="ciel-health-dot" aria-hidden="true" />
            <span><span className="block">Preview · {state.toLowerCase()}</span><span className="block text-[10px]">{healthLabels[health]}</span></span>
          </span>}
        </header>
        <div key={location.pathname} className="ciel-view" data-motion={motionEnabled ? "on" : "off"}><Outlet context={{ state, setState, health, setHealth, notification, setNotification, motionEnabled, setMotionEnabled, chatDraft, setChatDraft, chatMessages, setChatMessages, contextItems, setContextItems, planGoal, setPlanGoal, planSteps, setPlanSteps, automationDrafts, setAutomationDrafts, preferences, setPreferences, voiceRuntimePreference: getVoiceRuntimePreference(preferences), referenceNotes, setReferenceNotes, editorDrafts, setEditorDrafts, localSaveStatus, localSavingIssue, localSavingBlocked: !localSavingAllowed.current, retryLocalSaving, downloadLocalBackup, resetLocalWorkspace, restoreLocalBackup } satisfies CorePreview} /></div>
      </div>
      <dialog id="ciel-ring-menu" ref={ringMenuRef} className="ciel-ring-menu-dialog" aria-labelledby="ciel-ring-menu-title"
        onClick={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect()
          if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) event.currentTarget.close()
        }}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[.18em] text-primary">Ring index</p>
            <h2 id="ciel-ring-menu-title" className="mt-2 font-display text-2xl font-light">Choose a destination</h2>
          </div>
          <button type="button" aria-label="Close ring navigation" className="flex h-11 w-11 shrink-0 items-center justify-center rounded text-secondary-foreground transition hover:bg-primary/10 hover:text-primary" onClick={() => ringMenuRef.current?.close()}><X size={18} /></button>
        </div>
        <nav aria-label="Core and ring destinations" className="mt-6 grid gap-2">
          <NavLink to="/" end onClick={() => ringMenuRef.current?.close()} className="ciel-ring-menu-link">
            <span aria-hidden="true"><Home size={16} strokeWidth={1.4} /></span>
            <span><span className="block text-sm">Core</span><span className="mt-1 block text-xs text-muted-foreground">Return to the center</span></span>
            <ArrowRight size={16} aria-hidden="true" />
          </NavLink>
          <NavLink to={conversationWorkspace.path} onClick={() => ringMenuRef.current?.close()} className="ciel-ring-menu-link">
            <span aria-hidden="true"><MessageSquare size={16} strokeWidth={1.4} /></span>
            <span><span className="block text-sm">Conversation</span><span className="mt-1 block text-xs text-muted-foreground">Center orb · Talk to CIEL</span></span>
            <ArrowRight size={16} aria-hidden="true" />
          </NavLink>
          {ringWorkspaces.map((ring, index) => {
            const Symbol = ring.icon
            return <NavLink key={ring.name} to={ring.path} onClick={() => ringMenuRef.current?.close()} className="ciel-ring-menu-link">
              <span aria-hidden="true"><Symbol size={16} strokeWidth={1.4} /></span>
              <span><span className="block text-sm">Ring {index + 1} · {ring.title}</span><span className="mt-1 block text-xs leading-4 text-muted-foreground">{ring.description}</span></span>
              <ArrowRight size={16} aria-hidden="true" />
            </NavLink>
          })}
        </nav>
        <p className="mt-5 text-xs leading-5 text-muted-foreground">Touch-friendly navigation for every ring.</p>
      </dialog>
    </div>
  )
}

function HomeScreen() {
  const { state, setState, health, setHealth, notification, setNotification, motionEnabled, setMotionEnabled } = useOutletContext<CorePreview>()
  const [activeRing, setActiveRing] = useState<string | null>(null)
  const [selectedRing, setSelectedRing] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const previewRing = [conversationWorkspace, ...ringWorkspaces].find((ring) => ring.name === (activeRing ?? selectedRing))
  const [prompt, setPrompt] = useState("")
  const [response, setResponse] = useState("")
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const responseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useLayoutEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.style.height = "auto"
    input.style.height = `${Math.min(input.scrollHeight, 144)}px`
    input.style.overflowY = input.scrollHeight > 144 ? "auto" : "hidden"
  }, [prompt])
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.isComposing || event.repeat || document.querySelector("dialog[open]")) return
      const target = event.target as HTMLElement
      const editing = target.closest("input, textarea, select, [contenteditable='true']")
      if (event.ctrlKey && event.shiftKey && event.code === "Period") {
        event.preventDefault()
        if (responseTimer.current) clearTimeout(responseTimer.current)
        setState((current) => states[(states.indexOf(current) + 1) % states.length])
        setResponse("")
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        inputRef.current?.focus()
      }
      if (!editing && !event.ctrlKey && !event.metaKey && !event.altKey) {
        if (event.key === "/") {
          event.preventDefault()
          inputRef.current?.focus()
        }
        if (event.code === "Space" && !target.closest("button, a, summary")) {
          event.preventDefault()
          setMotionEnabled(!motionEnabled)
        }
        if (event.key.toLowerCase() === "z") {
          event.preventDefault()
          setExpanded((current) => !current)
        }
      }
      if (event.key === "Escape") {
        if (responseTimer.current) clearTimeout(responseTimer.current)
        setState("IDLE")
        setHealth("OFFLINE")
        setNotification(false)
        setResponse("")
        setSelectedRing(null)
        setActiveRing(null)
        setExpanded(false)
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => {
      window.removeEventListener("keydown", handleKey)
      if (responseTimer.current) clearTimeout(responseTimer.current)
    }
  }, [motionEnabled])
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const question = prompt.trim()
    if (!question || state === "THINKING") return
    if (responseTimer.current) clearTimeout(responseTimer.current)
    setPrompt("")
    setResponse("")
    setState("THINKING")
    responseTimer.current = setTimeout(() => {
      setState("SPEAKING")
      setResponse(question.toLowerCase().includes("focus")
        ? "One thing at a time. Choose what matters most, give it 25 uninterrupted minutes, and let everything else wait."
        : "This is a concept preview of CIEL: a calm space to think, learn, and make room for what matters.")
    }, 1800)
  }
  return (
    <main tabIndex={-1} className="ciel-home relative" data-expanded={expanded}>
      <div className="ciel-stage">
        <figure className="ciel-figure">
          <CielCore state={state} health={health} notification={notification} motionEnabled={motionEnabled} interactive activeRing={activeRing ?? selectedRing} selectedRing={selectedRing} onRingPreview={setActiveRing} onRingSelect={setSelectedRing} />
          <figcaption aria-live="polite" className="text-center font-mono text-[11px] tracking-[.22em] text-secondary-foreground">
            <button type="button" className="ciel-state-switch" aria-label={`Preview next Core state. Current: ${state}`}
              onClick={() => {
                if (responseTimer.current) clearTimeout(responseTimer.current)
                setResponse("")
                setState((current) => states[(states.indexOf(current) + 1) % states.length])
              }}><span className="text-[9px] tracking-normal text-muted-foreground">Preview · </span>{state}</button>
            <button type="button" aria-label="Enable animation" aria-pressed={motionEnabled}
              onClick={() => {
                const enabled = !motionEnabled
                setMotionEnabled(enabled)
              }}
              className="ml-4 inline-flex min-h-11 items-center text-[10px] tracking-normal text-muted-foreground hover:text-primary">
              Animation {motionEnabled ? "on" : "off"}
            </button>
            <button type="button" aria-label="Enlarge Core" aria-pressed={expanded}
              onClick={() => setExpanded((current) => !current)}
              className="ml-4 inline-flex min-h-11 items-center text-[10px] tracking-normal text-muted-foreground hover:text-primary">
              {expanded ? "Restore size" : "Enlarge"}
            </button>
          </figcaption>
          <div className="ciel-ring-hint" aria-live="polite">
            {selectedRing && previewRing && previewRing.name === selectedRing ? <>
              <span>{previewRing.name}</span>
              <NavLink to={previewRing.path} className="ciel-ring-open">Open {previewRing.title} →</NavLink>
              <button type="button" aria-label="Clear ring selection" onClick={() => { setSelectedRing(null); setActiveRing(null) }}><X size={16} /></button>
            </> : <span>{previewRing ? `Open ${previewRing.title}` : <><span className="ciel-hover-instruction">Hover a ring or the center to explore</span><span className="ciel-touch-instruction">Tap the center for Conversation · tap a ring to explore</span></>}</span>}
          </div>
          <div className="ciel-core-status" role="status">
            <button type="button" className="ciel-health-status" data-health={health.toLowerCase()} aria-label={`Preview next connection state. Current: ${health}`} title="Connection preview only; no services are connected" onClick={() => setHealth((current) => healthStates[(healthStates.indexOf(current) + 1) % healthStates.length])}>
              <span className="ciel-health-dot" aria-hidden="true" />{healthLabels[health]}
            </button>
            <button type="button" className="ciel-notification-toggle" aria-label="Preview notification" aria-pressed={notification} onClick={() => setNotification((current) => !current)} title="Preview an attention marker"><Bell size={14} /><span className="sr-only">Preview notification</span></button>
            {(state === "WORKING" || notification) && <p className="ciel-preview-note">{state === "WORKING" ? "Working preview · preparing a task" : "Notification preview · an update needs attention"}</p>}
          </div>
        </figure>
      </div>
      <section className="ciel-composer relative z-20" aria-label="Talk to CIEL">
        {response && <div className="absolute bottom-full mb-4 w-full rounded-md border border-primary/25 bg-card p-5 shadow-2xl">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-[.15em] text-primary">CIEL · CONCEPT RESPONSE</span>
            <button type="button" onClick={() => { setResponse(""); setState("IDLE") }}
              aria-label="Dismiss response" className="flex h-11 w-11 items-center justify-center text-secondary-foreground hover:text-primary">
              <X size={18} />
            </button>
          </div>
          <p className="mt-2 text-[13px] leading-6 text-secondary-foreground">{response}</p>
        </div>}
        <form onSubmit={submit} className={`flex items-end gap-2 rounded-xl border bg-[linear-gradient(110deg,#142339e0,#0b1321e0)] p-2 shadow-[inset_0_1px_0_#c8e5ff0b] transition focus-within:border-primary/60 focus-within:shadow-[0_0_22px_color-mix(in_srgb,var(--primary)_10%,transparent)] ${state === "LISTENING" ? "border-primary/60" : "border-primary/25"}`}>
          <textarea ref={inputRef} aria-label="Ask CIEL" rows={1} value={prompt} onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault()
                event.currentTarget.form?.requestSubmit()
              }
            }}
            placeholder={state === "LISTENING" ? "Listening preview · type your thoughts…" : "What's on your mind?"}
            className="min-h-12 max-h-36 min-w-0 flex-1 resize-none bg-transparent px-2 py-3 text-base leading-6 text-foreground placeholder:text-secondary-foreground focus-visible:ring-0 sm:text-sm" />
          <button type="button" aria-label={state === "LISTENING" ? "Stop listening preview" : "Preview listening state"}
            title="Voice preview only; no audio is captured" aria-pressed={state === "LISTENING"}
            onClick={() => {
              if (responseTimer.current) clearTimeout(responseTimer.current)
              setResponse("")
              setState(state === "LISTENING" ? "IDLE" : "LISTENING")
              inputRef.current?.focus()
            }}
            className={`mb-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition hover:bg-primary/10 hover:text-primary ${state === "LISTENING" ? "bg-primary/10 text-primary ring-1 ring-primary/40" : "text-secondary-foreground"}`}>
            <Mic size={19} strokeWidth={1.5} />
          </button>
          <button type="submit" aria-label="Send to CIEL" disabled={!prompt.trim() || state === "THINKING"}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded border border-primary/30 bg-primary/10 text-primary transition hover:bg-primary/20 disabled:cursor-default disabled:opacity-40">
            <ArrowUp size={19} />
          </button>
        </form>
      </section>
    </main>
  )
}

function Placeholder() {
  const location = useLocation()
  const destination = navigation.find((item) => item.path === location.pathname)
  const Icon = destination?.icon || Terminal
  return (
    <main className="relative flex min-h-[650px] flex-col items-center justify-center px-6 pb-20 text-center lg:h-[calc(100vh-104px)]">
      <div className="pointer-events-none absolute left-1/2 top-1/2 w-[min(65vw,680px)] -translate-x-1/2 -translate-y-1/2 opacity-20">
        <CielCore state="IDLE" />
      </div>
      <div className="relative z-10 flex h-14 w-14 items-center justify-center border border-primary/20 bg-card/70">
        <Icon size={25} strokeWidth={1.15} className="text-primary" />
      </div>
      <span className={`${metadata} relative mt-8`}>A SPACE TAKING SHAPE</span>
      <h1 className="relative mt-4 font-display text-4xl font-light">
        {destination?.title || "A little off the path."}
      </h1>
      <p className="relative mt-4 max-w-sm text-sm leading-7 text-secondary-foreground">
        {destination
          ? "This part of CIEL is waiting for its next chapter. For now, our journey begins at Home."
          : "Let's find our way back to CIEL."}
      </p>
      <NavLink
        to="/"
        className="relative mt-8 flex items-center gap-3 border border-primary/25 bg-primary/5 px-5 py-3 text-xs text-primary transition hover:bg-primary/10"
      >
        Return to Home <ArrowRight size={14} />
      </NavLink>
      <span className="relative mt-10 font-mono text-[9px] tracking-[.12em] text-muted-foreground">
        FIRST VISUAL CONCEPT / HOME EXPERIENCE
      </span>
    </main>
  )
}

const router = createBrowserRouter([
  {
    Component: Shell,
    children: [
      { index: true, Component: HomeScreen },
      ...workspaces.map((item) => ({ path: item.path, Component: RingWorkspace })),
      ...navigation
        .filter((item) => item.path !== "/" && !workspaces.some((workspace) => workspace.path === item.path))
        .map((item) => ({ path: item.path, Component: Placeholder })),
      { path: "*", Component: Placeholder },
    ],
  },
])
export default function App() {
  return <RouterProvider router={router} />
}
