import { redirect } from 'next/navigation'

// Adding items lives in the header search panel; the watchlist is home.
export default function HomePage() {
  redirect('/watchlist')
}
