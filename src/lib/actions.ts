import { getAuthToken } from 'deepspace'

export interface ActionResponse<T> {
  success: boolean
  data?: T
  error?: string
}

// Calls a server action with my sign-in token so the server knows who I am
export async function callAction<T>(
  name: string,
  params: Record<string, unknown>,
): Promise<ActionResponse<T>> {
  try {
    const token = await getAuthToken()
    const res = await fetch(`/api/actions/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(params),
    })
    return (await res.json()) as ActionResponse<T>
  } catch {
    // Network failure: answer in the same shape as a server error
    return { success: false, error: 'Could not reach the server. Check your connection.' }
  }
}

// Downloads a space file through the membership-checked route, as a local blob URL
export async function fetchSpaceFile(kind: 'resources' | 'notes', id: string) {
  const token = await getAuthToken()
  const res = await fetch(`/api/space-files/${kind}/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(res.status === 403 ? 'You do not have access to this file.' : 'Could not load the file.')
  return res.blob()
}
