// Server errors: the details go to the logs (Vercel), never to the browser. Raw
// database messages can reveal table, column and rule names.

export const SERVER_ERROR_MESSAGE = 'Something went wrong. Try again.'

/** Log `error` with a short context ("items: list") and answer with a plain 500. */
export function serverError(context: string, error: unknown): Response {
  const detail = error && typeof error === 'object' && 'message' in error ? (error as { message: unknown }).message : error
  console.error(`${context} failed:`, detail)
  return Response.json({ error: SERVER_ERROR_MESSAGE }, { status: 500 })
}
