-- Fix infinite recursion on public.messages INSERT RLS: the previous policy
-- referenced public.messages inside a policy on public.messages. Participant
-- check uses public.bookings only. "Consumer sends first" is enforced in
-- POST /api/messages/send, not in RLS.

drop policy if exists "Booking participants can insert messages" on public.messages;

create policy "Participants can insert messages"
  on public.messages
  for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and exists (
      select 1
      from public.bookings b
      where b.id = booking_id
        and (
          auth.uid() = b.consumer_user_id
          or auth.uid() = b.expert_user_id
        )
    )
  );
