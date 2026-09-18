export function SignedInMark({ signedIn }: { signedIn: boolean }) {
  return signedIn ? (
    <span className="signed-in" title="Signed in with Emby">
      <span aria-hidden="true"> ✓</span>
      <span className="visually-hidden"> (signed in)</span>
    </span>
  ) : null
}
