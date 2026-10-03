import { useEffect, useLayoutEffect, useRef, useState, type Dispatch, type SetStateAction, type FormEvent } from "react"
import { NavLink, useLocation, useOutletContext } from "react-router"
import type { CorePreview } from "./App"
import { createPreviewMessage, parseWorkspaceBackup, type EditorDrafts, type WorkspaceData } from "./localWorkspace"
import { ArrowLeft, ArrowUp, BookOpen, Check, Cpu, Keyboard, ListChecks, MessageSquare, Mic, Network, Plus, Settings as SettingsIcon, Square, X } from "lucide-react"

export const conversationWorkspace = { name: "Conversation", title: "Conversation", path: "/chat", radius: 72, width: 0, description: "Talk to CIEL, by text or voice.", icon: MessageSquare }

export const ringWorkspaces = [
  { name: "Context", title: "Context", path: "/context", radius: 133, width: 16, description: "What CIEL currently knows and uses.", icon: Network },
  { name: "Planning", title: "Planning", path: "/tasks", radius: 164, width: 18, description: "Plans, reasoning structure, and current objectives.", icon: ListChecks },
  { name: "Agents", title: "Agents / Tasks", path: "/agents", radius: 198, width: 16, description: "Coding, research, architect, and School Agent activity.", icon: Network },
  { name: "Capabilities", title: "Capabilities", path: "/capabilities", radius: 233, width: 32, description: "Voice, vision, web, computer, and plugins or tools.", icon: Cpu },
  { name: "Automations", title: "Automations / Integrations", path: "/automations", radius: 299, width: 30, description: "Messenger, Discord, Classroom, GitHub, and schedules.", icon: ListChecks },
  { name: "Settings", title: "Settings / System", path: "/system", radius: 350, width: 42, description: "Models, startup, permissions, appearance, and advanced configuration.", icon: SettingsIcon },
]

export const workspaces = [conversationWorkspace, ...ringWorkspaces,
  { name: "Reference notes", title: "Reference notes", path: "/memory", description: "Keep useful ideas within reach.", icon: BookOpen },
]

const panel = "rounded-lg border border-primary/15 bg-card/80 p-5"
const field = "w-full rounded-md border border-primary/20 bg-background/70 px-4 py-3 text-sm placeholder:text-muted-foreground"
const action = "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-primary/25 bg-primary/10 px-4 text-sm text-primary transition hover:bg-primary/20"
const agentNames = ["Coding agent", "Research agent", "Architect agent", "School Agent"]
const planStages = ["To plan", "In progress", "Complete", "Blocked"]

function useEditorDraft<Key extends keyof EditorDrafts>(key: Key) {
  const { editorDrafts, setEditorDrafts } = useOutletContext<CorePreview>()
  const update = <Field extends keyof EditorDrafts[Key]>(field: Field, value: EditorDrafts[Key][Field]) => setEditorDrafts((current) => ({ ...current, [key]: { ...current[key], [field]: value } }))
  return [editorDrafts[key], update] as const
}

function useRemovalUndo<Item extends { id: string }>(items: Item[], setItems: Dispatch<SetStateAction<Item[]>>) {
  const [removed, setRemoved] = useState<{ item: Item; index: number } | null>(null)
  const remove = (id: string) => {
    const index = items.findIndex((item) => item.id === id)
    if (index < 0) return
    setRemoved({ item: items[index], index })
    setItems((current) => current.filter((item) => item.id !== id))
  }
  const undo = () => {
    if (!removed) return
    setItems((current) => {
      if (current.some((item) => item.id === removed.item.id)) return current
      const restored = [...current]
      restored.splice(Math.min(removed.index, restored.length), 0, removed.item)
      return restored
    })
    setRemoved(null)
  }
  return { removed, remove, undo, dismiss: () => setRemoved(null) }
}

function RemovalNotice({ label, undo, dismiss }: { label: string; undo: () => void; dismiss: () => void }) {
  return <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-md border border-primary/20 bg-card p-2 text-xs"><span role="status" className="mr-auto">{label} removed. Undo is available until you leave this page.</span><button type="button" className={action} onClick={undo}>Undo removal</button><button type="button" className={action} aria-label="Dismiss undo" onClick={dismiss}><X size={15} /></button></div>
}

function Conversation() {
  const { state, setState, health, preferences, chatDraft: draft, setChatDraft: setDraft, chatMessages: messages, setChatMessages: setMessages, localSaveStatus } = useOutletContext<CorePreview>()
  const removal = useRemovalUndo(messages, setMessages)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState("")
  const [confirmClear, setConfirmClear] = useState(false)
  const [mode, setMode] = useState<"text" | "voice">("text")
  const [replyPending, setReplyPending] = useState(false)
  const [issue, setIssue] = useState("")
  const transcriptRef = useRef<HTMLDivElement>(null)
  const messageRef = useRef<HTMLTextAreaElement>(null)
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ownsActivity = useRef(false)
  const stopPreview = () => {
    if (previewTimer.current) clearTimeout(previewTimer.current)
    previewTimer.current = null
    setReplyPending(false)
    if (ownsActivity.current) setState("IDLE")
    ownsActivity.current = false
  }
  useEffect(() => () => {
    if (previewTimer.current) clearTimeout(previewTimer.current)
    if (ownsActivity.current) setState("IDLE")
  }, [setState])
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.isComposing || event.repeat || document.querySelector("dialog[open]")) return
      const editing = (event.target as HTMLElement).closest("input, textarea, select, [contenteditable='true']")
      if (((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") || (!editing && !event.ctrlKey && !event.metaKey && !event.altKey && event.key === "/")) {
        event.preventDefault(); setMode("text"); setTimeout(() => messageRef.current?.focus(), 0)
      }
      if (event.key === "Escape") { stopPreview(); setIssue("") }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [])
  useEffect(() => {
    const transcript = transcriptRef.current
    if (transcript) transcript.scrollTop = transcript.scrollHeight
  }, [messages, replyPending, mode])
  useLayoutEffect(() => {
    const input = messageRef.current
    if (!input) return
    input.style.height = "auto"
    input.style.height = `${Math.min(input.scrollHeight, 104)}px`
  }, [draft, mode])
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!draft.trim() || replyPending) return
    if (health === "ERROR") { setIssue("Preview connection error. Nothing was sent; your draft is kept."); return }
    stopPreview()
    setIssue("")
    setMessages((current) => [...current, createPreviewMessage("user", draft.trim())])
    setDraft("")
    ownsActivity.current = true
    setReplyPending(true)
    setState("THINKING")
    previewTimer.current = setTimeout(() => {
      setMessages((current) => [...current, createPreviewMessage("assistant", "This is a sample reply so you can try the conversation layout. CIEL's assistant engine is not connected, and your message was not sent to a service.")])
      setReplyPending(false)
      setState("SPEAKING")
      previewTimer.current = setTimeout(() => { setState("IDLE"); ownsActivity.current = false; previewTimer.current = null }, 1600)
    }, 1000)
  }
  const starters = ["Help me plan something", "Explain an idea simply", "Think through a problem"]
  return <section aria-label="Conversation preview" className="ciel-conversation">
    <div className="ciel-conversation-toolbar">
      <div className="ciel-conversation-modes" role="group" aria-label="Conversation mode">
        <button type="button" aria-pressed={mode === "text"} onClick={() => { stopPreview(); setMode("text") }}><MessageSquare size={15} aria-hidden="true" />Text</button>
        <button type="button" aria-pressed={mode === "voice"} onClick={() => { stopPreview(); setMode("voice") }}><Mic size={15} aria-hidden="true" />Voice</button>
      </div>
      <span className="text-[10px] text-muted-foreground">Preview · Not connected</span>
      {messages.length > 0 && <button type="button" className={action} onClick={() => setConfirmClear(true)}>Clear conversation</button>}
    </div>
    {confirmClear && <div role="group" aria-label="Confirm clear conversation" className="flex shrink-0 flex-wrap items-center gap-2 border-b border-primary/20 p-3 text-xs">
      <p role="alert">Clear all local messages? This cannot be undone. Your unsent draft is kept.</p>
      <button type="button" className={action} onClick={() => { stopPreview(); setMessages([]); setEditingId(null); removal.dismiss(); setConfirmClear(false); messageRef.current?.focus() }}>Confirm clear</button>
      <button type="button" className={action} onClick={() => setConfirmClear(false)}>Keep conversation</button>
    </div>}
    {removal.removed && <RemovalNotice label="Message" undo={removal.undo} dismiss={removal.dismiss} />}
    {mode === "text" ? <>
      <div key="text" ref={transcriptRef} role="log" aria-label="Conversation messages" aria-live="polite" className="ciel-conversation-transcript ciel-conversation-mode">
        {messages.length === 0 ? <div className="ciel-conversation-empty">
          <div aria-hidden="true" className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-primary/20 bg-primary/5 text-lg text-primary">✳</div>
          <h2 className="font-display text-2xl font-light sm:text-3xl">What shall we explore?</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-secondary-foreground">Try a prompt or write your own. Replies here are samples; no assistant is connected.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {starters.map((starter) => <button key={starter} type="button" onClick={() => { setDraft(starter); messageRef.current?.focus() }} className="min-h-11 rounded-md border border-primary/15 bg-background/40 px-3 text-xs text-secondary-foreground transition duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus-visible:text-primary">{starter}</button>)}
          </div>
        </div> : messages.map((message) => <article key={message.id} className="ciel-chat-message" data-role={message.role}>
          <p className="mb-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{message.role === "user" ? "You" : "CIEL"} · {message.source === "preview" ? "Preview" : "Runtime"}</p>
          {editingId === message.id ? <form onSubmit={(event) => { event.preventDefault(); if (!editText.trim()) return; setMessages((current) => current.map((item) => item.id === message.id ? { ...item, content: editText.trim() } : item)); setEditingId(null) }}>
            <textarea className={field} aria-label="Edit preview message" rows={3} maxLength={20000} value={editText} onChange={(event) => setEditText(event.target.value)} />
            <div className="mt-2 flex flex-wrap gap-2"><button type="submit" className={action} disabled={!editText.trim()}>Save message</button><button type="button" className={action} onClick={() => setEditingId(null)}>Cancel edit</button></div>
          </form> : <p className="ciel-chat-bubble">{message.content}</p>}
          <div className="mt-1 flex flex-wrap gap-2">
            {message.source === "preview" && editingId !== message.id && <button type="button" className={action} onClick={() => { if (editingId && !window.confirm("Discard the unfinished message edit?")) return; stopPreview(); setEditingId(message.id); setEditText(message.content) }}>Edit message</button>}
            <button type="button" className={action} onClick={() => { if (editingId === message.id && editText !== message.content && !window.confirm("Discard the unfinished message edit and remove this message?")) return; stopPreview(); removal.remove(message.id); if (editingId === message.id) setEditingId(null) }}>Remove message</button>
          </div>
        </article>)}
        {replyPending && <p role="status" className="flex items-center gap-2 text-xs text-primary"><span className="ciel-chat-thinking" aria-hidden="true">···</span>Previewing a reply…</p>}
      </div>
      {(issue || health === "ERROR") && <p role="alert" className="ciel-chat-issue">{issue || "Preview connection error. Your draft remains editable."}</p>}
      <form onSubmit={submit} className="ciel-conversation-composer">
      <label className="sr-only" htmlFor="conversation-message">Message to CIEL</label>
        <textarea ref={messageRef} id="conversation-message" aria-label="Conversation message" aria-describedby="ciel-chat-note" rows={1} value={draft} onChange={(event) => { setDraft(event.target.value); setIssue("") }} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} placeholder="Write a message…" />
        {replyPending ? <button type="button" className={`${action} h-11 w-11 shrink-0 px-0`} aria-label="Stop reply preview" onClick={stopPreview}><Square size={15} /></button>
          : <button type="submit" className={`${action} h-11 w-11 shrink-0 px-0`} aria-label="Add message to preview" disabled={!draft.trim()}><ArrowUp size={18} /></button>}
      </form>
      <p id="ciel-chat-note" className="ciel-chat-note">Sample replies · no messages sent · {localSaveStatus}</p>
    </> : <div key="voice" className="ciel-voice-view ciel-conversation-mode">
      <div className="ciel-voice-visual" data-speaking={state === "SPEAKING"} data-listening={state === "LISTENING"} aria-hidden="true">{[0, 1, 2, 3, 4].map((index) => <span key={index} style={{ animationDelay: `${index * -.2}s` }} />)}</div>
      <h2 className="font-display text-2xl">Voice preview</h2>
      <p role="status" className="mt-2 text-sm text-primary">{state === "LISTENING" ? "Listening animation" : state === "SPEAKING" ? "Speaking animation" : "Ready to preview"}</p>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-secondary-foreground">Voice is not connected. These controls animate CIEL without recording your microphone or playing audio.</p>
      <p className="mt-4 text-sm">Voice: {preferences.voiceLanguage === "ja" ? "Japanese" : "English"} · Subtitles: {({ en: "English", ja: "Japanese", both: "Both languages", off: "Off" })[preferences.subtitleMode]}</p>
      <NavLink className={`${action} mt-3`} to="/system#voice-settings"><SettingsIcon size={15} />Voice settings</NavLink>
      <p className="mx-auto mt-3 max-w-sm text-xs leading-5 text-muted-foreground">If the chosen voice is unavailable, use text only. Missing translations show the original text with a notice. These rules are prepared for the future voice connection.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button type="button" className={action} aria-pressed={state === "LISTENING"} aria-label={state === "LISTENING" ? "Stop voice preview" : "Preview voice"} onClick={() => { const listening = state === "LISTENING"; stopPreview(); if (listening) setState("IDLE"); else { ownsActivity.current = true; setState("LISTENING") } }}><Mic size={16} />{state === "LISTENING" ? "Stop preview" : "Preview listening"}</button>
        <button type="button" className={action} onClick={() => { stopPreview(); ownsActivity.current = true; setState("SPEAKING"); previewTimer.current = setTimeout(stopPreview, 2400) }}>Preview speaking</button>
      </div>
      {draft && <p className="mt-5 text-xs text-muted-foreground">Your text draft is kept when you switch back.</p>}
    </div>}
  </section>
}

function Context() {
  const { contextItems, setContextItems, chatMessages } = useOutletContext<CorePreview>()
  const removal = useRemovalUndo(contextItems, setContextItems)
  const [{ selectedId, title, content, editingId, editTitle, editContent }, updateDraft] = useEditorDraft("context")
  const [issue, setIssue] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)
  const selected = contextItems.find((item) => item.id === selectedId) ?? contextItems[0]
  const editingSource = contextItems.find((item) => item.id === editingId)
  const editChanged = editingSource && (editTitle !== editingSource.title || editContent !== editingSource.content)
  const clearEdit = () => { updateDraft("editingId", null); updateDraft("editTitle", ""); updateDraft("editContent", "") }
  const add = (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim() || !content.trim()) return
    const item = { id: crypto.randomUUID(), title: title.trim(), content: content.trim(), pinned: false, source: "Manual" as const }
    setContextItems((current) => [...current, item])
    updateDraft("selectedId", item.id)
    updateDraft("title", ""); updateDraft("content", ""); setIssue("")
  }
  return <div className="grid gap-6">
    <div className="ciel-page-summary"><span>{contextItems.length} local sources</span><span>{contextItems.filter((item) => item.pinned).length} pinned</span><span>{chatMessages.filter((message) => message.role === "user").length} conversation messages</span></div>
    <p className="ciel-page-note">Prepared context is saved in this browser. Nothing here is sent to CIEL. Saving status and backups are in Settings.</p>
    <div className="ciel-inspector-layout">
      <aside className={panel}>
        <h2 className="mb-4 font-display text-xl">Available context</h2>
        <div className="grid gap-2">
          {contextItems.map((item) => <button key={item.id} type="button" aria-pressed={selected?.id === item.id} className="ciel-source-row" onClick={() => updateDraft("selectedId", item.id)}><span>{item.title}</span><span className="text-[10px] text-muted-foreground">{item.source}{item.pinned ? " · Pinned" : ""}{item.id === editingId && editChanged ? " · Unfinished edit" : ""}</span></button>)}
          {contextItems.length === 0 && <p className="ciel-page-note">Add a goal, constraint, reference, or text file to get started.</p>}
        </div>
        <button type="button" className={`${action} mt-5 w-full`} onClick={() => fileRef.current?.click()}><Plus size={16} />Add text file</button>
        <input ref={fileRef} type="file" accept=".txt,.md,.json" className="sr-only" tabIndex={-1} aria-label="Context text file" onChange={async (event) => {
          const file = event.target.files?.[0]
          event.target.value = ""
          if (!file) return
          if (file.size > 262144 || !/\.(txt|md|json)$/i.test(file.name)) { setIssue("Choose a TXT, MD, or JSON file up to 256 KB."); return }
          try {
            const text = await file.text()
            if (!text.trim()) { setIssue("That file is empty. Choose a file with text."); return }
            const item = { id: crypto.randomUUID(), title: file.name, content: text, pinned: false, source: "File" as const }
            setContextItems((current) => [...current, item]); updateDraft("selectedId", item.id); setIssue("")
          } catch { setIssue("That file could not be read. You can paste its text below.") }
        }} />
        {issue && <p role="alert" className="mt-3 text-sm text-[#ff8995]">{issue}</p>}
        <p className="mt-3 text-[11px] leading-5 text-muted-foreground">TXT, MD, JSON · up to 256 KB · local browser copy</p>
      </aside>
      <section className={panel}>
        {selected ? <>
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-2xl [overflow-wrap:anywhere]">{selected.title}</h2><span className="ciel-state-tag">{selected.source} · {selected.edited ? "Edited locally" : "Local"}</span></div>
          {editingId === selected.id ? <form className="my-5 grid gap-4" onSubmit={(event) => {
            event.preventDefault()
            if (!editTitle.trim() || !editContent.trim()) return
            setContextItems((current) => current.map((item) => item.id === selected.id ? { ...item, title: editTitle.trim(), content: editContent, edited: true } : item))
            clearEdit()
          }}>
            <label className="ciel-field-label">Title<input className={field} aria-label="Edit context title" maxLength={255} value={editTitle} onChange={(event) => updateDraft("editTitle", event.target.value)} /></label>
            <label className="ciel-field-label">Content<textarea className={field} aria-label="Edit context content" rows={6} maxLength={262144} value={editContent} onChange={(event) => updateDraft("editContent", event.target.value)} /></label>
            <div className="flex flex-wrap gap-3"><button type="submit" className={action} disabled={!editTitle.trim() || !editContent.trim()}>Save context changes</button><button type="button" className={action} onClick={clearEdit}>Cancel edit</button></div>
            <p className="ciel-page-note">{selected.source === "File" ? "Edits change the local copy. The original file stays unchanged." : "Your unfinished edit is kept locally. Select Save context changes to apply it."}</p>
          </form> : <pre className="ciel-context-content">{selected.content}</pre>}
          <div className="flex flex-wrap gap-3">
            {editingId !== selected.id && <button type="button" className={action} onClick={() => { if (editChanged && !window.confirm("Discard the unfinished context edit and edit this source?")) return; updateDraft("editingId", selected.id); updateDraft("editTitle", selected.title); updateDraft("editContent", selected.content) }}>Edit context</button>}
            <button type="button" className={action} aria-pressed={selected.pinned} onClick={() => setContextItems((current) => current.map((item) => item.id === selected.id ? { ...item, pinned: !item.pinned } : item))}>{selected.pinned ? "Unpin context" : "Pin context"}</button>
            <button type="button" className={action} onClick={() => { if (editingId === selected.id && editChanged && !window.confirm("Discard the unfinished edit and remove this context?")) return; removal.remove(selected.id); updateDraft("selectedId", null); if (editingId === selected.id) clearEdit() }}><X size={15} />Remove context</button>
          </div>
        </> : <div className="ciel-inspector-empty"><Network size={25} aria-hidden="true" /><h2 className="mt-4 font-display text-2xl">Make context visible</h2><p className="mt-3 text-sm leading-6 text-secondary-foreground">Your selected source appears here, with its original text and local origin.</p></div>}
      </section>
    </div>
    {removal.removed && <RemovalNotice label="Context" undo={removal.undo} dismiss={removal.dismiss} />}
    <form onSubmit={add} className={panel}>
      <h2 className="mb-4 font-display text-xl">Add context</h2><p className="ciel-page-note mb-4">Unfinished text is kept when you switch pages or refresh.</p>
      <label className="ciel-field-label">Title<input className={field} aria-label="Context title" maxLength={160} value={title} onChange={(event) => updateDraft("title", event.target.value)} placeholder="A goal, constraint, or reference" /></label>
      <label className="ciel-field-label mt-4">Content<textarea rows={4} className={field} aria-label="Context content" maxLength={20000} value={content} onChange={(event) => updateDraft("content", event.target.value)} placeholder="What should be available to CIEL later?" /></label>
      <button type="submit" className={`${action} mt-4`} disabled={!title.trim() || !content.trim()}><Plus size={16} />Add context</button>
    </form>
    <section className={panel}><h2 className="font-display text-xl">Connected sources</h2><p className="mt-3 text-sm text-secondary-foreground">Gmail, Drive, and Discord are not connected. No external sources are loaded.</p><NavLink to="/memory" className={`${action} mt-5`}><BookOpen size={16} />Open reference notes</NavLink></section>
  </div>
}

function Planning() {
  const { planGoal, setPlanGoal, planSteps, setPlanSteps, contextItems } = useOutletContext<CorePreview>()
  const [{ draft }, updateDraft] = useEditorDraft("planning")
  const completed = planSteps.filter((step) => step.stage === 2).length
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!draft.trim()) return
    setPlanSteps((current) => [...current, { id: crypto.randomUUID(), title: draft.trim(), stage: 0, note: "", agent: "Unassigned" }])
    updateDraft("draft", "")
  }
  return <div className="grid gap-6">
    <section className={panel}>
      <label className="ciel-field-label">Current objective<input aria-label="Planning objective" maxLength={300} className={field} value={planGoal} onChange={(event) => setPlanGoal(event.target.value)} placeholder="What are you trying to finish?" /></label>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-secondary-foreground"><span>{completed} of {planSteps.length} steps complete</span><span>{planSteps.filter((step) => step.stage === 3).length} blocked</span></div>
      <progress className="ciel-plan-progress" aria-label="Plan progress" value={completed} max={planSteps.length || 1} />
      <p className="ciel-page-note">Manual planning preview. Updating a step or assigning an agent does not start work.</p>
    </section>
    <form onSubmit={submit} className="mb-3 flex flex-col gap-3 sm:flex-row">
      <input aria-label="New planning task" maxLength={300} className={field} value={draft} onChange={(event) => updateDraft("draft", event.target.value)} placeholder="Add a step to your plan…" />
      <button type="submit" className={`${action} shrink-0`} disabled={!draft.trim()} aria-label="Add task"><Plus size={18} />Add step</button>
    </form>
    <ol className="grid gap-3" aria-label="Plan steps">
      {planSteps.map((step, index) => <li key={step.id} className={`${panel} ciel-plan-step`} data-stage={step.stage}>
        <div className="flex items-start gap-3"><span className="ciel-step-number">{step.stage === 2 ? <Check size={15} /> : String(index + 1).padStart(2, "0")}</span><h2 className="min-w-0 flex-1 text-sm leading-6 [overflow-wrap:anywhere]">{step.title || "Untitled step"}</h2><button type="button" className="flex h-11 w-11 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-primary/10 hover:text-primary" aria-label={`Remove task: ${step.title}`} onClick={() => setPlanSteps((current) => current.filter((item) => item.id !== step.id))}><X size={15} /></button></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="ciel-field-label">Status<select className={field} aria-label={`Status: ${step.title}`} value={step.stage} onChange={(event) => setPlanSteps((current) => current.map((item) => item.id === step.id ? { ...item, stage: Number(event.target.value) } : item))}>{planStages.map((name, stage) => <option key={name} value={stage}>{name}</option>)}</select></label>
          <label className="ciel-field-label">Agent assignment · draft<select className={field} aria-label={`Agent: ${step.title}`} value={step.agent} onChange={(event) => setPlanSteps((current) => current.map((item) => item.id === step.id ? { ...item, agent: event.target.value } : item))}>{["Unassigned", ...agentNames].map((name) => <option key={name}>{name}</option>)}</select></label>
        </div>
        <details className="mt-4"><summary className="ciel-detail-summary">{step.stage === 3 ? "Blocker / notes" : "Notes / result"}</summary><label className="ciel-field-label mt-3">Step title<input className={field} maxLength={300} aria-label={`Edit step title: ${index + 1}`} value={step.title} onChange={(event) => setPlanSteps((current) => current.map((item) => item.id === step.id ? { ...item, title: event.target.value } : item))} placeholder="Step title" /></label><textarea className={`${field} mt-3`} rows={3} aria-label={`Notes: ${step.title}`} value={step.note} onChange={(event) => setPlanSteps((current) => current.map((item) => item.id === step.id ? { ...item, note: event.target.value } : item))} placeholder={step.stage === 3 ? "What prevents this step from moving forward?" : "Record a decision or result…"} /></details>
      </li>)}
      {planSteps.length === 0 && <li className={`${panel} ciel-inspector-empty`}><ListChecks size={25} aria-hidden="true" /><h2 className="mt-4 font-display text-2xl">Give the goal a path</h2><p className="mt-3 text-sm text-secondary-foreground">Add ordered steps, track blockers, and record the result.</p></li>}
    </ol>
    <section className={panel}><h2 className="font-display text-xl">Prepared context</h2><p className="mt-3 text-sm text-secondary-foreground">{contextItems.length} local sources · {contextItems.filter((item) => item.pinned).length} pinned. These are available to inspect, and are not automatically sent to agents.</p><NavLink to="/context" className={`${action} mt-4`}>Inspect context</NavLink></section>
    <p className="ciel-page-note">Your plan is saved locally in this browser. Saving status and backups are in Settings.</p>
  </div>
}

function Knowledge() {
  const { referenceNotes: notes, setReferenceNotes: setNotes } = useOutletContext<CorePreview>()
  const [{ selected, title, body }, updateDraft] = useEditorDraft("notes")
  const [search, setSearch] = useState("")
  const dirty = selected === null ? Boolean(title || body) : title !== notes[selected]?.title || body !== notes[selected]?.body
  const mayReplace = () => !dirty || window.confirm("Discard this unfinished note edit? Your saved note stays unchanged.")
  const save = (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim() || !body.trim()) return
    const note = { title: title.trim(), body: body.trim() }
    updateDraft("title", note.title); updateDraft("body", note.body)
    if (selected === null) {
      setNotes([...notes, note])
      updateDraft("selected", notes.length)
    } else setNotes(notes.map((item, index) => index === selected ? note : item))
  }
  const matchingNotes = notes.flatMap((note, index) =>
    `${note.title} ${note.body}`.toLowerCase().includes(search.trim().toLowerCase()) ? [{ note, index }] : [],
  )
  return <div className="grid gap-6 md:grid-cols-[250px_1fr]">
    <aside className={panel}>
      <button className={`${action} mb-4 w-full`} onClick={() => { if (!mayReplace()) return; updateDraft("selected", null); updateDraft("title", ""); updateDraft("body", ""); setSearch("") }}><Plus size={16} />New note</button>
      {notes.length > 0 && <input aria-label="Search notes" className={`${field} mb-4 text-sm`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search notes…" />}
      {matchingNotes.map(({ note, index }) => <button key={index} aria-pressed={selected === index} className={`mb-2 min-h-11 w-full rounded px-3 py-2 text-left text-sm transition-colors hover:bg-primary/5 ${selected === index ? "bg-primary/10 text-primary" : "text-secondary-foreground"}`}
        onClick={() => { if (index === selected || !mayReplace()) return; updateDraft("selected", index); updateDraft("title", note.title); updateDraft("body", note.body) }}>{note.title}</button>)}
      {notes.length === 0 && <p className="text-xs leading-6 text-muted-foreground">Your notes will appear here.</p>}
      {notes.length > 0 && matchingNotes.length === 0 && <p className="text-xs leading-6 text-muted-foreground">No notes match that search.</p>}
    </aside>
    <form onSubmit={save} className={panel}>
      {selected !== null && !matchingNotes.some(({ index }) => index === selected) && <p className="mb-3 text-xs text-muted-foreground">Editing “{notes[selected]?.title}”, which doesn’t match this search.</p>}
      <input aria-label="Note title" className={field} placeholder="Note title" value={title} onChange={(event) => updateDraft("title", event.target.value)} />
      <textarea aria-label="Note content" rows={9} className={`${field} mt-4`} placeholder="Keep an idea, reference, or useful detail…" value={body} onChange={(event) => updateDraft("body", event.target.value)} />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">Unfinished edits stay in this browser. Save note applies them. Assistant memory is not connected.</p>
        <button className={action} disabled={!title.trim() || !body.trim()}>Save note</button>
      </div>
    </form>
  </div>
}

function Agents() {
  const { planSteps, preferences } = useOutletContext<CorePreview>()
  const [selected, setSelected] = useState(0)
  const agents = [
    { name: "Coding agent", description: "Implementation, debugging, and code checks.", toolkit: "Files, code, and test tools", scope: "A selected project and an approved task." },
    { name: "Research agent", description: "Sources, findings, and supporting evidence.", toolkit: "Web search and source reading", scope: "A research question and sources you choose." },
    { name: "Architect agent", description: "System design, constraints, and technical decisions.", toolkit: "Context, planning, and project references", scope: "Requirements and constraints for a design decision." },
    { name: "School Agent", description: "Classroom work, deadlines, and study tasks.", toolkit: "Classroom and document tools", scope: "Selected classes, assignments, and study material." },
  ]
  const agent = agents[selected]
  const assignments = planSteps.filter((step) => step.agent === agent.name)
  return <div className="grid gap-6">
    <div className="ciel-page-summary"><span>0 connected agents</span><span>{planSteps.filter((step) => step.agent !== "Unassigned").length} draft assignments</span><span>No agent execution</span></div>
    <div className="ciel-inspector-layout">
      <aside className={panel} aria-label="Agent roster"><h2 className="mb-4 font-display text-xl">Agent roster</h2><div className="grid gap-2">
        {agents.map((item, index) => <button key={item.name} type="button" className="ciel-source-row" aria-pressed={selected === index} onClick={() => setSelected(index)}><span>{item.name}</span><span className="text-[10px] text-muted-foreground">Not connected · {planSteps.filter((step) => step.agent === item.name).length} draft tasks</span></button>)}
      </div></aside>
      <section className={panel} aria-label="Selected agent">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-2xl">{agent.name}</h2><span className="ciel-state-tag">Not connected</span></div>
        <p className="mt-4 text-sm leading-6 text-secondary-foreground">{agent.description}</p>
        <dl className="ciel-detail-list">
          <div><dt>Preferred model · draft</dt><dd>{preferences.model}</dd></div><div><dt>Planned toolkit</dt><dd>{agent.toolkit}</dd></div><div><dt>Task scope</dt><dd>{agent.scope}</dd></div><div><dt>Permissions</dt><dd>None granted · tools unavailable</dd></div>
        </dl>
        <h3 className="mt-6 text-sm text-secondary-foreground">Draft assignments</h3>
        {assignments.length > 0 ? <ul className="mt-3 grid gap-3">{assignments.map((step) => <li key={step.id} className="rounded border border-primary/15 p-3 text-sm"><span className="block [overflow-wrap:anywhere]">{step.title}</span><span className="mt-2 block text-xs text-muted-foreground">Manual plan · {planStages[step.stage]}</span></li>)}</ul> : <p className="mt-3 text-sm leading-6 text-muted-foreground">No local plan steps are assigned to this agent.</p>}
        <NavLink to="/tasks" className={`${action} mt-5`}>Open planning objectives</NavLink>
      </section>
    </div>
    <section className={panel}>
      <h2 className="font-display text-xl">Agent activity</h2>
      <p className="mt-3 text-sm leading-6 text-secondary-foreground">No runtime or log source is connected. Draft assignments do not dispatch work or indicate that an agent is running.</p>
    </section>
  </div>
}

function Automations() {
  const { automationDrafts, setAutomationDrafts, motionEnabled } = useOutletContext<CorePreview>()
  const removal = useRemovalUndo(automationDrafts, setAutomationDrafts)
  const [{ name, trigger, destination, cadence, selectedId, editingId }, updateDraft] = useEditorDraft("workflow")
  const editingWorkflow = automationDrafts.find((item) => item.id === editingId)
  const changed = editingWorkflow ? name !== editingWorkflow.name || trigger !== editingWorkflow.trigger || destination !== editingWorkflow.destination || cadence !== editingWorkflow.cadence : Boolean(name) || trigger !== "Messenger" || destination !== "Discord" || cadence !== "On event"
  const mayReplace = () => !changed || window.confirm("Discard the unfinished workflow form? Your saved workflow stays unchanged.")
  const clearForm = () => { updateDraft("editingId", null); updateDraft("name", ""); updateDraft("trigger", "Messenger"); updateDraft("destination", "Discord"); updateDraft("cadence", "On event") }
  const formRef = useRef<HTMLFormElement>(null)
  const integrations = [
    ["Messenger → Discord", "Messenger", "Discord", "On event"],
    ["Classroom updates", "Classroom", "Discord", "On event"],
    ["GitHub discovery", "GitHub", "Local summary", "Daily"],
    ["Scheduled check", "Schedule", "Local summary", "Weekly"],
  ]
  const selected = automationDrafts.find((item) => item.id === selectedId) ?? automationDrafts[0]
  return <div className="grid gap-6">
    <div className="ciel-page-summary"><span>{automationDrafts.length} workflow drafts</span><span>0 running automations</span><span>Integrations not connected</span></div>
    {removal.removed && <RemovalNotice label="Workflow draft" undo={removal.undo} dismiss={removal.dismiss} />}
    <p className="ciel-page-note">Unfinished workflow forms stay in this browser when you switch pages or refresh. Draft settings never schedule, publish, or send anything.</p>
    <section className={panel}><h2 className="font-display text-xl">Start from a workflow</h2><div className="mt-4 flex flex-wrap gap-2">{integrations.map(([title, source, target, timing]) => <button type="button" key={title} className={action} onClick={() => { if (!mayReplace()) return; updateDraft("editingId", null); updateDraft("name", title); updateDraft("trigger", source); updateDraft("destination", target); updateDraft("cadence", timing) }}>{title}</button>)}</div></section>
    <form ref={formRef} className={panel} onSubmit={(event) => {
      event.preventDefault()
      if (!name.trim()) return
      if (editingId) {
        setAutomationDrafts((current) => current.map((item) => item.id === editingId ? { ...item, name: name.trim(), trigger, destination, cadence } : item))
        updateDraft("selectedId", editingId); updateDraft("editingId", null)
      } else {
        const item = { id: crypto.randomUUID(), name: name.trim(), trigger, destination, cadence, enabled: false }
        setAutomationDrafts((current) => [...current, item]); updateDraft("selectedId", item.id)
      }
      clearForm()
    }}>
      <h2 className="mb-4 font-display text-xl">{editingId ? "Edit workflow draft" : "Create a workflow draft"}</h2>
      <label className="ciel-field-label">Workflow name<input className={field} aria-label="Workflow name" maxLength={160} value={name} onChange={(event) => updateDraft("name", event.target.value)} placeholder="Name your workflow" /></label>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <label className="ciel-field-label">Source<select aria-label="Workflow source" className={field} value={trigger} onChange={(event) => updateDraft("trigger", event.target.value)}>{["Messenger", "Classroom", "GitHub", "Schedule"].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="ciel-field-label">Destination<select aria-label="Workflow destination" className={field} value={destination} onChange={(event) => updateDraft("destination", event.target.value)}>{["Discord", "Local summary"].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="ciel-field-label">Trigger<select aria-label="Workflow cadence" className={field} value={cadence} onChange={(event) => updateDraft("cadence", event.target.value)}>{["On event", "Daily", "Weekly"].map((value) => <option key={value}>{value}</option>)}</select></label>
      </div>
      <div className="mt-4 flex flex-wrap gap-3"><button type="submit" className={action} disabled={!name.trim()}><Plus size={16} />{editingId ? "Save workflow changes" : "Create draft"}</button>{editingId && <button type="button" className={action} onClick={clearForm}>Cancel workflow edit</button>}</div>
    </form>
    <div className="ciel-inspector-layout">
      <aside className={panel}><h2 className="mb-4 font-display text-xl">Workflow drafts</h2><div className="grid gap-2">{automationDrafts.map((item) => <button type="button" key={item.id} className="ciel-source-row" aria-pressed={selected?.id === item.id} onClick={() => updateDraft("selectedId", item.id)}><span>{item.name}</span><span className="text-[10px] text-muted-foreground">{item.enabled ? "Enabled draft" : "Paused draft"} · Not connected</span></button>)}{automationDrafts.length === 0 && <p className="ciel-page-note">No workflow drafts yet.</p>}</div></aside>
      <section className={panel} aria-label="Workflow details">{selected ? <>
        <h2 className="font-display text-2xl [overflow-wrap:anywhere]">{selected.name}</h2>
        <div className="ciel-workflow-path"><span>{selected.trigger}</span><ArrowUp size={15} className="rotate-90" aria-hidden="true" /><span>{selected.destination}</span></div>
        <dl className="ciel-detail-list"><div><dt>Trigger</dt><dd>{selected.cadence} · timing not configured</dd></div><div><dt>Required connections</dt><dd>{selected.trigger === "Schedule" ? "Scheduler" : selected.trigger} and {selected.destination === "Discord" ? "Discord" : "assistant engine"} · unavailable</dd></div><div><dt>Last run</dt><dd>Never run · local draft only</dd></div></dl>
<div className="mt-5 flex flex-wrap gap-3">{editingId !== selected.id && <button type="button" className={action} onClick={() => { if (!mayReplace()) return; updateDraft("editingId", selected.id); updateDraft("name", selected.name); updateDraft("trigger", selected.trigger); updateDraft("destination", selected.destination); updateDraft("cadence", selected.cadence); formRef.current?.scrollIntoView({ block: "start", behavior: motionEnabled ? "smooth" : "instant" }); formRef.current?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true }) }}>Edit workflow</button>}<button type="button" className={action} role="switch" aria-checked={selected.enabled} aria-label="Enable workflow draft" onClick={() => setAutomationDrafts((current) => current.map((item) => item.id === selected.id ? { ...item, enabled: !item.enabled } : item))}>{selected.enabled ? "Enabled draft" : "Paused draft"}</button><button type="button" className={action} onClick={() => { if (editingId === selected.id && !mayReplace()) return; removal.remove(selected.id); updateDraft("selectedId", null); if (editingId === selected.id) clearForm() }}><X size={15} />Remove draft</button></div>
        <p className="mt-4 text-xs leading-6 text-muted-foreground">Enabled describes your draft preference. This workflow cannot run until its connections and schedule are configured.</p>
      </> : <div className="ciel-inspector-empty"><ListChecks size={25} aria-hidden="true" /><h2 className="mt-4 font-display text-2xl">A workflow with a purpose</h2><p className="mt-3 text-sm text-secondary-foreground">Create a draft to inspect its source, destination, and trigger.</p></div>}</section>
    </div>
    <section className={panel}>
      <h2 className="font-display text-xl">Recent runs and failures</h2>
      <p className="mt-3 text-sm leading-6 text-secondary-foreground">No event source is connected. There are no real runs, failures, or publications to display.</p>
    </section>
  </div>
}

function Capabilities() {
  const { contextItems, motionEnabled } = useOutletContext<CorePreview>()
  const detailRef = useRef<HTMLElement>(null)
  const tools = [
    { name: "Voice", description: "Listen and speak with CIEL.", details: [["Voice identity", "Not configured"], ["Wake word", "Not configured"], ["Microphone", "Inactive · no audio captured"], ["Speech recognition / STT", "Not connected"], ["Speech synthesis / TTS", "Not connected"]] },
    { name: "Vision", description: "Understand images and visual references.", details: [["Image input", "Not connected"], ["Vision model", "Not configured"]] },
    { name: "Web", description: "Search and read online sources.", details: [["Search provider", "Not connected"], ["Browser tools", "Not connected"]] },
    { name: "Computer", description: "Interact with apps and computer workflows.", details: [["Computer access", "Not connected"], ["Permissions", "Not granted"]] },
    { name: "Plugins / Tools", description: "Extend CIEL with connected tools.", details: [["Connected tools", "None"], ["Tool execution", "Unavailable"]] },
    { name: "Files", description: "Prepare local text references for future tasks.", details: [["Local text references", String(contextItems.filter((item) => item.source === "File").length)], ["Supported local preview", "TXT, MD, JSON · up to 256 KB"], ["Assistant file access", "Not connected"]] },
    { name: "Code", description: "Review and work on code with a coding agent.", details: [["Coding agent", "Not connected"], ["Code execution", "Unavailable"], ["Workspace permissions", "None granted"]] },
  ]
  const [selected, setSelected] = useState(0)
  return <div className="ciel-inspector-layout">
    <section className={`${panel} grid gap-2`} aria-label="Available capabilities">
      {tools.map((tool, index) => <button key={tool.name} aria-pressed={selected === index} onClick={() => setSelected(index)}
        onClickCapture={() => { if (window.matchMedia("(max-width: 899px)").matches) requestAnimationFrame(() => detailRef.current?.scrollIntoView({ block: "start", behavior: motionEnabled ? "smooth" : "instant" })) }}
        className="ciel-source-row">
        <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />{tool.name === "Files" ? "Local text preview" : "Not connected"}</span>
        <span className="font-display text-lg">{tool.name}</span>
      </button>)}
    </section>
    <aside ref={detailRef} className={panel} aria-label="Capability details">
      <h2 className="font-display text-2xl">{tools[selected].name}</h2>
      <p className="mt-4 text-sm leading-7 text-secondary-foreground">{tools[selected].description}</p>
      <dl className="mt-6 grid gap-4">
        {tools[selected].details.map(([label, value]) => <div key={label} className="border-t border-primary/10 pt-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-sm text-secondary-foreground">{value}</dd></div>)}
      </dl>
      <p className="mt-6 text-xs leading-6 text-muted-foreground">Controls become available when this capability is connected.</p>
      {tools[selected].name === "Voice" && <NavLink className={`${action} mt-4`} to="/chat">Open Conversation preview</NavLink>}
      {tools[selected].name === "Files" && <NavLink className={`${action} mt-4`} to="/context">Prepare local references</NavLink>}
      {tools[selected].name === "Code" && <NavLink className={`${action} mt-4`} to="/agents">Inspect coding agent</NavLink>}
    </aside>
  </div>
}

function System() {
  const { motionEnabled: motion, setMotionEnabled: setMotion, preferences, setPreferences, localSaveStatus, localSavingIssue, localSavingBlocked, retryLocalSaving, downloadLocalBackup, resetLocalWorkspace, restoreLocalBackup } = useOutletContext<CorePreview>()
  const backupInput = useRef<HTMLInputElement>(null)
  const readAttempt = useRef(0)
  const [backup, setBackup] = useState<{ name: string; data: WorkspaceData } | null>(null)
  const [reading, setReading] = useState(false)
  const [backupIssue, setBackupIssue] = useState("")
  const [restored, setRestored] = useState(false)
  useEffect(() => () => { readAttempt.current++ }, [])
  const shortcuts: [string, string][] = [
    ["?", "Open Settings"],
    ["Alt + 0", "Return to Core"],
    ["Alt + C", "Open Conversation"],
    ...ringWorkspaces.map((ring, index): [string, string] => ["Alt + " + (index + 1), "Open " + ring.name]),
    ["Ctrl / ⌘ + K", "Focus Home or Conversation composer"],
    ["/", "Focus Home or Conversation composer"],
    ["Space", "Pause / resume animation"],
    ["Z", "Enlarge / restore Core"],
    ["Ctrl + Shift + .", "Preview next state"],
    ["Esc", "Clear Core selection / stop chat preview"],
    ["Tab / Enter", "Focus / open a ring"],
  ]
  return <div className="grid gap-6">
    <p className="ciel-page-note">Appearance controls affect this interface. Model, startup, and confirmation choices are local drafts; they do not configure connected services.</p>
    <section className={panel} aria-label="Local data"><h2 className="font-display text-2xl">Local data</h2><p role="status" className="mt-3 text-sm text-primary">{localSaveStatus}</p><p className="mt-3 text-xs leading-6 text-muted-foreground">Messages, text drafts, prepared context, plans, workflow drafts, saved notes, unfinished forms, and draft settings stay in this browser on this address. They are not synced to another device. Clearing browser data removes them.</p>{localSavingIssue && <p role="alert" className="mt-4 text-sm leading-6 text-[#ff8995]">{localSavingIssue}</p>}<div className="mt-5 flex flex-wrap gap-3"><button type="button" className={action} onClick={() => downloadLocalBackup()}>Download local backup</button>{localSavingBlocked && <button type="button" className={action} onClick={() => downloadLocalBackup(true)}>Download stored copy</button>}{localSavingIssue && !localSavingBlocked && <button type="button" className={action} onClick={retryLocalSaving}>Retry saving</button>}<button type="button" className={action} onClick={() => backupInput.current?.click()} disabled={reading}>{reading ? "Reading backup…" : "Choose backup to restore"}</button><button type="button" className={action} onClick={resetLocalWorkspace}>Reset local workspace</button></div>
      <input ref={backupInput} className="sr-only" type="file" tabIndex={-1} accept=".json,application/json" aria-label="CIEL backup file" onChange={async (event) => {
        const file = event.target.files?.[0]
        event.target.value = ""
        if (!file) return
        const attempt = ++readAttempt.current
        setBackup(null); setBackupIssue(""); setRestored(false)
        if (file.size > 5242880 || !/\.json$/i.test(file.name)) { setBackupIssue("Choose a CIEL JSON backup up to 5 MB."); return }
        setReading(true)
        try {
          const data = parseWorkspaceBackup(await file.text())
          if (readAttempt.current === attempt) setBackup({ name: file.name, data })
        } catch { if (readAttempt.current === attempt) setBackupIssue("This file could not be opened as a valid CIEL version 1 backup. Your current workspace is unchanged.") }
        finally { if (readAttempt.current === attempt) setReading(false) }
      }} />
      {backupIssue && <p role="alert" className="mt-4 text-sm leading-6 text-[#ff8995]">{backupIssue}</p>}
      {restored && <p role="status" className="mt-4 text-sm text-primary">Backup restored and saved in this browser.</p>}
      {backup && <div className="mt-5 rounded-md border border-primary/25 bg-background/60 p-4" role="region" aria-label="Review backup">
        <h3 className="text-sm text-primary [overflow-wrap:anywhere]">{backup.name}</h3>
        <p className="mt-3 text-sm leading-6 text-secondary-foreground">{backup.data.chatMessages.length} messages · {backup.data.contextItems.length} context sources · {backup.data.planSteps.length} plan steps · {backup.data.automationDrafts.length} workflows · {backup.data.referenceNotes.length} notes</p>
        <p className="mt-3 text-xs leading-6 text-muted-foreground">Restoring replaces this browser's CIEL workspace, including unfinished edits and draft settings. Download a local backup first to keep your current work. Animation preferences stay as they are.</p>
        <div className="mt-4 flex flex-wrap gap-3"><button type="button" className={action} onClick={() => downloadLocalBackup()}>Back up current workspace</button><button type="button" className={action} onClick={() => {
          const issue = restoreLocalBackup(backup.data)
          setBackupIssue(issue)
          if (!issue) { setBackup(null); setRestored(true) }
        }}>Replace workspace with backup</button><button type="button" className={action} onClick={() => { readAttempt.current++; setBackup(null); setBackupIssue(""); setReading(false) }}>Cancel restore</button></div>
      </div>}
    </section>
    <div className="grid gap-6 md:grid-cols-2">
      <section id="voice-settings" tabIndex={-1} className={`${panel} scroll-mt-6`} aria-label="Voice settings">
        <h2 className="font-display text-2xl">Voice</h2>
        <fieldset className="mt-5"><legend className="text-sm text-secondary-foreground">Voice language</legend>
          <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg border border-primary/15 bg-background/60 p-1">
            {([["en", "English"], ["ja", "Japanese"]] as const).map(([value, label]) => <label key={value} className="min-w-0 cursor-pointer">
              <input className="peer sr-only" type="radio" name="voice-language" value={value} checked={preferences.voiceLanguage === value} onChange={() => setPreferences((current) => ({ ...current, voiceLanguage: value }))} />
              <span className="flex min-h-11 items-center justify-center rounded-md border border-transparent px-2 text-sm text-muted-foreground transition-colors duration-200 hover:text-primary peer-checked:border-primary/30 peer-checked:bg-primary/10 peer-checked:text-primary peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-primary motion-reduce:transition-none">{label}</span>
            </label>)}
          </div>
        </fieldset>
        <fieldset className="mt-5"><legend className="text-sm text-secondary-foreground">Subtitles</legend>
          <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg border border-primary/15 bg-background/60 p-1 sm:grid-cols-4">
            {([["en", "English"], ["ja", "Japanese"], ["both", "Both"], ["off", "Off"]] as const).map(([value, label]) => <label key={value} className="min-w-0 cursor-pointer">
              <input className="peer sr-only" type="radio" name="subtitle-mode" value={value} checked={preferences.subtitleMode === value} onChange={() => setPreferences((current) => ({ ...current, subtitleMode: value, subtitlePreferenceExplicit: true }))} />
              <span className="flex min-h-11 items-center justify-center rounded-md border border-transparent px-2 text-sm text-muted-foreground transition-colors duration-200 hover:text-primary peer-checked:border-primary/30 peer-checked:bg-primary/10 peer-checked:text-primary peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-primary motion-reduce:transition-none">{label}</span>
            </label>)}
          </div>
        </fieldset>
        <p className="mt-4 text-xs leading-6 text-muted-foreground">One CIEL voice identity in English or Japanese. English subtitles are the default; your chosen subtitle preference stays when you switch languages.</p>
        <p className="mt-3 text-xs leading-6 text-muted-foreground">Saved for future voice sessions. Speech output is not connected yet. Changing these settings does not start audio or your microphone.</p>
      </section>
      <section className={panel}><h2 className="font-display text-2xl">Appearance</h2>
        <label className="ciel-field-label mt-5">Layout density<select aria-label="Layout density" className={field} value={preferences.density} onChange={(event) => setPreferences((current) => ({ ...current, density: event.target.value }))}>{["Comfortable", "Compact"].map((value) => <option key={value}>{value}</option>)}</select></label>
        <button className={`${action} mt-4 w-full`} aria-pressed={motion} onClick={() => setMotion(!motion)}>Animation {motion ? "on" : "off"}</button><p className="mt-3 text-xs leading-6 text-muted-foreground">Motion follows your device preference until you choose an override. Your animation choice is saved in this browser.</p>
      </section>
      <section className={panel}><h2 className="font-display text-2xl">Models</h2>
        <label className="ciel-field-label mt-5">Preferred model · draft<select aria-label="Preferred model draft" className={field} value={preferences.model} onChange={(event) => setPreferences((current) => ({ ...current, model: event.target.value }))}>{["Not selected", "Luna", "Sol", "Astra", "Local Qwen"].map((value) => <option key={value}>{value}</option>)}</select></label>
        <dl className="ciel-detail-list"><div><dt>Active model</dt><dd>Not connected</dd></div><div><dt>Switching rules</dt><dd>Not configured</dd></div></dl>
      </section>
      <section className={panel}><h2 className="font-display text-2xl">Startup</h2>
        <label className="ciel-field-label mt-5">Preferred opening screen · draft<select aria-label="Startup screen draft" className={field} value={preferences.startup} onChange={(event) => setPreferences((current) => ({ ...current, startup: event.target.value }))}>{["Core", "Conversation"].map((value) => <option key={value}>{value}</option>)}</select></label><p className="mt-3 text-xs leading-6 text-muted-foreground">A preference for future setup. Background launch, OS startup, and service recovery are not configured.</p>
      </section>
      <section className={panel}><h2 className="font-display text-2xl">Permissions and confirmations</h2>
        <label className="ciel-field-label mt-5">Confirmation policy · draft<select aria-label="Confirmation policy draft" className={field} value={preferences.confirmations} onChange={(event) => setPreferences((current) => ({ ...current, confirmations: event.target.value }))}>{["Always ask", "Ask before changes"].map((value) => <option key={value}>{value}</option>)}</select></label><p className="mt-3 text-xs leading-6 text-muted-foreground">This draft grants no access. Microphone, computer control, accounts, and publishing permissions remain unavailable.</p>
      </section>
    </div>
    <section id="keyboard-shortcuts" tabIndex={-1} className={panel}>
      <div className="mb-4 flex items-center gap-3">
        <Keyboard size={18} className="text-primary" aria-hidden="true" />
        <div>
          <h2 className="font-display text-2xl">Keyboard shortcuts</h2>
          <p className="mt-1 text-xs text-muted-foreground">Quick navigation and Core controls. Press ? to return here.</p>
        </div>
      </div>
      <dl className="ciel-shortcut-list grid gap-x-8 sm:grid-cols-2">
        {shortcuts.map(([key, label]) => <div key={key}><dt><kbd>{key}</kbd></dt><dd>{label}</dd></div>)}
      </dl>
      <p className="mt-4 text-xs text-muted-foreground">Letter shortcuts pause while you type. Space keeps its normal behavior on buttons and links.</p>
    </section>
    <section className={panel}>
      <h2 className="mb-5 font-display text-2xl">Connections</h2>
      {[["Interface", "Available"], ["Voice chat", "Not connected"], ["Assistant engine", "Not connected"], ["Tools and memory", "Not connected"]].map(([name, status]) => <div key={name} className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-t border-primary/10 py-4 transition-colors hover:bg-primary/[0.03]">
        <span className="text-sm">{name}</span><span className="flex items-center gap-2 text-xs"><span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${status === "Available" ? "bg-primary" : "bg-muted-foreground/50"}`} /><span className={status === "Available" ? "text-primary" : "text-muted-foreground"}>{status}</span></span>
      </div>)}
    </section>
    <details className={panel}><summary className="ciel-detail-summary">Advanced configuration</summary><dl className="ciel-detail-list"><div><dt>Assistant bridge</dt><dd>Not configured</dd></div><div><dt>GPU / RAM telemetry</dt><dd>No hardware source connected</dd></div><div><dt>Integration credentials</dt><dd>No account configuration in this preview</dd></div></dl><p className="mt-4 text-xs leading-6 text-muted-foreground">Bridge and runtime settings belong to the later integration phase.</p></details>
  </div>
}

export default function RingWorkspace() {
  const location = useLocation()
  useEffect(() => {
    if (location.hash !== "#voice-settings") return
    const section = document.getElementById("voice-settings")
    section?.scrollIntoView({ block: "start" })
    section?.focus({ preventScroll: true })
  }, [location.pathname, location.hash])
  const workspace = workspaces.find((item) => item.path === location.pathname)
  const ringIndex = ringWorkspaces.findIndex((item) => item.path === location.pathname)
  if (!workspace) return null
  return <main className={`ciel-workspace relative z-10 px-6 pb-10 md:px-12 ${workspace.path === "/chat" ? "ciel-chat-workspace" : "pt-6"}`}>
    <div className={`mx-auto max-w-[1100px] ${workspace.path === "/chat" ? "ciel-chat-layout" : ""}`}>
      {workspace.path === "/chat" ? <header className="ciel-chat-heading"><h1 tabIndex={-1} className="font-display text-2xl font-light">Conversation</h1><NavLink to="/" className="inline-flex min-h-11 items-center gap-2 text-xs text-secondary-foreground hover:text-primary"><ArrowLeft size={15} />Core</NavLink></header> : <>
      <NavLink to="/" className="inline-flex min-h-11 items-center gap-2 text-xs text-secondary-foreground hover:text-primary"><ArrowLeft size={15} />Back to Core</NavLink>
      <header className="mb-8 mt-5 flex flex-wrap items-end justify-between gap-4">
        <div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-primary">{ringIndex >= 0 ? `Ring ${ringIndex + 1} · ${workspace.name}` : workspace.path === "/chat" ? "Center orb" : workspace.name}</p>
        <h1 tabIndex={-1} className="mt-3 font-display text-4xl font-light">{workspace.title}</h1><p className="mt-3 text-sm text-secondary-foreground">{workspace.description}</p></div>
        <span className="rounded-full border border-primary/20 px-3 py-2 font-mono text-[9px] tracking-wider text-muted-foreground">LOCAL WORKSPACE</span>
      </header></>}
      {workspace.path === "/chat" && <Conversation />}
      {workspace.path === "/context" && <Context />}
      {workspace.path === "/tasks" && <Planning />}
      {workspace.path === "/agents" && <Agents />}
      {workspace.path === "/memory" && <Knowledge />}
      {workspace.path === "/capabilities" && <Capabilities />}
      {workspace.path === "/automations" && <Automations />}
      {workspace.path === "/system" && <System />}
    </div>
  </main>
}
