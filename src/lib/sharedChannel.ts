/**
 * Shared Supabase Channel Manager
 *
 * Problem: Multiple hooks independently call `supabase.channel(topic)` and
 * `supabase.removeChannel(channel)` for the same topic (e.g., `user:${userId}`).
 * Supabase multiplexes channels by topic — calling removeChannel() from one hook
 * tears down the shared WebSocket for all hooks, causing infinite reconnection storms.
 *
 * Solution: Reference-counted channel manager. Each consumer acquires a channel
 * and registers broadcast listeners. The channel is only subscribed once and only
 * removed when the last consumer releases it.
 */
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface SharedChannelEntry {
  channel: RealtimeChannel;
  refCount: number;
  subscribed: boolean;
  pendingSubscribe: boolean;
}

const channels = new Map<string, SharedChannelEntry>();

/**
 * Acquire a shared channel by topic name.
 * The channel is created and subscribed on first acquire; subsequent calls
 * increment the reference count and return the same channel instance.
 */
export function acquireChannel(topic: string): RealtimeChannel {
  const existing = channels.get(topic);
  if (existing) {
    existing.refCount++;
    return existing.channel;
  }

  const channel = supabase.channel(topic);
  const entry: SharedChannelEntry = {
    channel,
    refCount: 1,
    subscribed: false,
    pendingSubscribe: false,
  };
  channels.set(topic, entry);
  return channel;
}

/**
 * Subscribe the shared channel if not already subscribed.
 * Safe to call multiple times — only the first call triggers .subscribe().
 */
export function subscribeChannel(topic: string): void {
  const entry = channels.get(topic);
  if (!entry || entry.subscribed || entry.pendingSubscribe) return;

  entry.pendingSubscribe = true;
  entry.channel.subscribe((status, err) => {
    if (status === 'SUBSCRIBED') {
      entry.subscribed = true;
      entry.pendingSubscribe = false;
    } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      entry.subscribed = false;
      entry.pendingSubscribe = false;
      if (err) {
        console.warn(`[SharedChannel] ${topic} error:`, err);
      }
    }
  });
}

/**
 * Release a reference to a shared channel.
 * When the last consumer releases, the channel is unsubscribed and removed.
 */
export function releaseChannel(topic: string): void {
  const entry = channels.get(topic);
  if (!entry) return;

  entry.refCount--;
  if (entry.refCount <= 0) {
    channels.delete(topic);
    try {
      supabase.removeChannel(entry.channel);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Get the current channel for a topic without modifying ref count.
 * Returns null if no channel exists for this topic.
 */
export function getChannel(topic: string): RealtimeChannel | null {
  return channels.get(topic)?.channel ?? null;
}

/**
 * Check if a channel topic is currently subscribed.
 */
export function isChannelSubscribed(topic: string): boolean {
  return channels.get(topic)?.subscribed ?? false;
}
