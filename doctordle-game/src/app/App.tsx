import { SignInButton, SignedIn, SignedOut } from '@clerk/clerk-react'
import GamePage from '../pages/GamePage'

export default function App() {
  return (
    <>
      <SignedIn>
        <GamePage />
      </SignedIn>

      <SignedOut>
        <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
          <SignInButton mode="modal">
            <button
              type="button"
              className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white"
            >
              Sign in to play
            </button>
          </SignInButton>
        </div>
      </SignedOut>
    </>
  )
}
