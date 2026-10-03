# CIEL frontend runtime boundary

No assistant, microphone, speech provider, or integration is connected by this change. Conversation sends remain local previews. The runtime contract is prepared and tested, not registered with a transport.

src/app/runtimeContract.ts exports parseRuntimeEvent(unknown). A future authenticated adapter must reject null before updating UI state:

- activity: IDLE, LISTENING, THINKING, SPEAKING, WORKING. Update CIEL activity only.
- health: OFFLINE, CONNECTED, DEGRADED, ERROR. Update connection health independently.
- notification: boolean pending. Update the separate notification indicator.
- reply: stable server id, literal content, optional validated voice, optional boolean speechAvailable. Append an assistant message with source runtime; ignore IDs already received. Render content as text, never HTML.

Stop local preview timers before runtime takes control. Use a real send operation before labeling messages as sent. Saved preferences do not prove connectivity. Local persistence must not restore a false live connection.

Voice preferences have one source: existing workspace preferences. resolveVoiceDelivery returns a delivery plan, not audio playback. Only matching available speech can be played. If the chosen language is unavailable, retain text and show its notice; never switch voices automatically. Missing translated subtitles show available original text with an explicit language notice. Subtitles Off stays off. A failed playback must also fall back to text and show a notice.

Recovery controls edit preview messages locally. Removing a message, context item, or workflow draft offers one Undo until another removal, dismissal, or page exit. Undo restores only that item, preserving changes to other items. Clear conversation asks for confirmation, stops pending preview replies, keeps the unsent composer draft, and cannot be undone. Unfinished message edits can be canceled; context and workflow forms keep their existing draft persistence.
