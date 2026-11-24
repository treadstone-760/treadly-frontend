import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import type { AiConversation, AiMessage, List } from '../api/types'
import { RequireWorkspace } from '../auth/WorkspaceProvider'
import { Button, ErrorBanner, PageHeader, QueryState } from '../components/ui'
import { unwrapList } from '../lib/format'

export function AssistantPage() {
  return (
    <RequireWorkspace>
      {(workspace) => <AssistantView id={workspace.id} />}
    </RequireWorkspace>
  )
}

function AssistantView({ id }: { id: string }) {
  const queryClient = useQueryClient()
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<AiMessage[]>([])
  const conversations = useQuery({
    queryKey: ['ai', id],
    queryFn: async () => (await api.get<List<AiConversation>>(`/workspaces/${id}/ai/conversations`)).data.data,
  })
  const chat = useMutation({
    mutationFn: async (message: string) => {
      const response = await api.post<{ data: AiConversation }>(`/workspaces/${id}/ai/chat`, {
        message,
        conversation_id: conversationId,
      })
      return response.data.data
    },
    onSuccess: async (conversation) => {
      setConversationId(conversation.id)
      setMessages(unwrapList(conversation.messages) as AiMessage[])
      setDraft('')
      await queryClient.invalidateQueries({ queryKey: ['ai', id] })
    },
  })

  async function openConversation(conversation: AiConversation) {
    const response = await api.get<{ data: AiConversation }>(`/ai/conversations/${conversation.id}`)
    setConversationId(response.data.data.id)
    setMessages(unwrapList(response.data.data.messages) as AiMessage[])
  }

  return (
    <>
      <PageHeader
        eyebrow="Assistant"
        title="Ask about this book"
        lede="The assistant sees prepared totals for this workspace only. It cannot move money, and its figures are not guaranteed projections."
      />
      <div className="chat-layout">
        <aside className="card">
          <h2>Conversations</h2>
          <QueryState isLoading={conversations.isLoading} error={conversations.error}>
            <ul className="plain">
              {conversations.data?.map((conversation) => (
                <li key={conversation.id}>
                  <button type="button" className="text-btn" onClick={() => void openConversation(conversation)}>
                    {conversation.title}
                  </button>
                </li>
              ))}
            </ul>
          </QueryState>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setConversationId(null)
              setMessages([])
            }}
          >
            New chat
          </Button>
        </aside>
        <section className="card chat">
          <ErrorBanner error={chat.error} />
          <div className="thread">
            {messages.length === 0 ? <p className="muted">Ask how spending looks this month, or where a budget stands.</p> : null}
            {messages.map((message) => (
              <article key={message.id} className={message.role === 'user' ? 'bubble me' : 'bubble'}>
                <p>{message.content}</p>
              </article>
            ))}
          </div>
          <form
            className="composer"
            onSubmit={(event) => {
              event.preventDefault()
              const message = draft.trim()
              if (!message || chat.isPending) return
              chat.mutate(message)
            }}
          >
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={3}
              maxLength={4000}
              placeholder="Ask a question about recorded activity"
            />
            <Button type="submit" disabled={chat.isPending || draft.trim() === ''}>
              {chat.isPending ? 'Thinking…' : 'Send'}
            </Button>
          </form>
        </section>
      </div>
    </>
  )
}
