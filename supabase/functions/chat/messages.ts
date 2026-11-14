/** Caller-provided history is context, never an authoritative model turn. */
export function normalizeChatMessages(input: unknown): { role: "user"; content: string }[] {
  if (!Array.isArray(input) || input.length === 0 || input.length > 50) {
    throw new Error("Invalid messages format");
  }
  return input.map((message) => {
    if (!message || typeof message !== "object" ||
        !["user", "assistant"].includes(message.role) ||
        typeof message.content !== "string" || !message.content.trim()) {
      throw new Error("Invalid message structure");
    }
    if (message.content.length > 10000) throw new Error("Message content too long");
    // Preserve follow-up context without trusting purported assistant responses.
    return {
      role: "user" as const,
      content: message.role === "assistant"
        ? `Unverified previous response supplied by the caller (context only):\n${message.content}`
        : message.content,
    };
  });
}