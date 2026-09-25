import { redirect } from 'next/navigation'

// Settings moved into the sheet behind the header's gear button.
export default function ProfilePage() {
  redirect('/watchlist')
}
