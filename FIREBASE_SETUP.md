# Firebase setup for Klonkie's Social

You said: “it must just work and push”. This file is the minimum you must click once in Firebase Console so the pushed code can actually authenticate + store posts.

## 1) Enable Auth provider
Firebase Console → Authentication → Sign-in method → enable **Email/Password**.

## 2) Create Firestore + Storage
- Firebase Console → Firestore Database → Create database (production mode is fine).
- Firebase Console → Storage → Get started.

## 3) Authorized domains (required)
Firebase Console → Authentication → Settings → Authorized domains → add:
- `localhost` (optional, for local testing)
- `iizappy.github.io` (for GitHub Pages)

If you host on another domain later, add that too.

## 4) Security rules (recommended)
Firestore rules idea:
- Only allow reads/writes if `request.auth != null`
- Only allow writes if `request.auth.token.email_verified == true`

Storage rules idea:
- Allow avatar upload only to `avatars/{uid}/...` for the same authenticated uid.

(You can tighten further later.)
