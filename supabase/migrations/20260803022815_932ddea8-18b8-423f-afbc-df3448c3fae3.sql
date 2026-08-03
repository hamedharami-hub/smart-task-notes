REVOKE ALL ON FUNCTION public.get_effective_share_permission(uuid, public.share_resource_type, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_effective_share_permission(uuid, public.share_resource_type, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.accept_share(_share_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.shares
  SET recipient_id = auth.uid(), accepted_at = now(), updated_at = now()
  WHERE id = _share_id
    AND (recipient_id = auth.uid()
         OR lower(recipient_email) = lower((SELECT email FROM auth.users WHERE id = auth.uid())));
$$;
REVOKE ALL ON FUNCTION public.accept_share(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_share(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.decline_share(_share_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.shares
  WHERE id = _share_id
    AND (recipient_id = auth.uid()
         OR lower(recipient_email) = lower((SELECT email FROM auth.users WHERE id = auth.uid())));
$$;
REVOKE ALL ON FUNCTION public.decline_share(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decline_share(uuid) TO authenticated;