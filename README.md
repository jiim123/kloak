**Kloak**
A privacy-first communication platform. An alternative to Discord that doesn't monetize your data.

**What is Kloak**
Kloak is a messaging platform where privacy is built into the architecture, not bolted on as a feature. It is hosted in Sweden under Swedish privacy law, uses cryptographic secret keys instead of email and password logins, and is funded by subscriptions instead of ads or data harvesting.

**Features**
Servers and channels for organizing communities
Direct messaging with real-time delivery
Role-based permissions for access control
Ghost Mode channel type for anonymous messaging
Cross-server emoji support
Avatar decorations
Voice chat powered by LiveKit (in development)

**Tech Stack**
Frontend: React, TypeScript, Tailwind CSS
State Management: Zustand
Backend: Supabase (Auth, Database, Realtime, Edge Functions)
Animations: Framer Motion
Voice and Video: LiveKit

**How it works**
All user actions update in real time across all connected clients using Supabase Realtime subscriptions and optimistic UI updates.
All access control is enforced server-side through Supabase Row Level Security policies. Client-side checks are not trusted.
Only data necessary for the platform to function is stored. No analytics or behavioral fingerprinting.
