// The code from an invite link, kept in localStorage so it survives the trip
// through Google sign-in (which can't carry it) until it's redeemed. It isn't
// per user, so switching accounts on the invite screen keeps it.
const KEY = "journal_invite_code";

export const inviteLink = (code: string) =>
  `${window.location.origin}/invite/${code}`;

export function savePendingInvite(code: string) {
  try {
    localStorage.setItem(KEY, code.trim().toUpperCase());
  } catch {
    // Storage disabled: the invitee can still type the code.
  }
}

export function readPendingInvite(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearPendingInvite() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
