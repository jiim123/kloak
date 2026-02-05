 import { useEffect, useRef } from 'react';
 import { supabase } from '@/integrations/supabase/client';
 import { patchUserAcrossStores } from './useRealtimeUsers';
 import type { User } from '@/types';
 
 /**
  * Maximum number of user IDs to include in a single realtime filter.
  * Supabase has limits on filter string length; beyond this we skip subscription.
  */
 const MAX_USER_IDS_FOR_SUBSCRIPTION = 100;
 
 /**
  * Hook for subscribing to real-time updates for a specific set of users.
  * 
  * This creates a targeted subscription to the `users` table filtered by the provided IDs.
  * When any of those users update their profile (status, avatar, etc.), the update is
  * automatically propagated to all relevant stores via `patchUserAcrossStores`.
  * 
  * @param userIds - Array of user IDs to subscribe to
  * @param channelName - Unique channel name for this subscription
  * @param onUpdate - Optional callback when a user is updated
  */
 export const useRealtimeUserUpdates = (
   userIds: string[],
   channelName: string,
   onUpdate?: (user: User) => void
 ) => {
   const onUpdateRef = useRef(onUpdate);
   onUpdateRef.current = onUpdate;
 
   useEffect(() => {
     // Skip if no user IDs or too many (fall back to polling for large sets)
     if (userIds.length === 0 || userIds.length > MAX_USER_IDS_FOR_SUBSCRIPTION) {
       return;
     }
 
     // Create filter string: id=in.(uuid1,uuid2,...)
     const filterValue = `(${userIds.join(',')})`;
 
     const channel = supabase
       .channel(channelName)
       .on(
         'postgres_changes',
         {
           event: 'UPDATE',
           schema: 'public',
           table: 'users',
           filter: `id=in.${filterValue}`,
         },
         (payload) => {
           const updatedUser = payload.new as User;
           
           // Patch all stores with the updated user data
           patchUserAcrossStores(updatedUser);
           
           // Call optional callback
           if (onUpdateRef.current) {
             onUpdateRef.current(updatedUser);
           }
         }
       )
       .subscribe();
 
     return () => {
       supabase.removeChannel(channel);
     };
   }, [userIds.join(','), channelName]); // Re-subscribe when user IDs change
 };