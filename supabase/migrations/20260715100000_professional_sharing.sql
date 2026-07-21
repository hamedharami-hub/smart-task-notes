-- Professional sharing: explicit accept/decline, permission helper, and subtask sharing

-- 1. Require accepted_at for access (with folder and parent-task cascade)
CREATE OR REPLACE FUNCTION public.has_share_access(
  _user_id uuid,
  _resource_type public.share_resource_type,
  _resource_id uuid,
  _min_permission public.share_permission DEFAULT 'view'
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH RECURSIVE levels AS (
    SELECT CASE _min_permission
      WHEN 'view' THEN 1
      WHEN 'comment' THEN 2
      WHEN 'edit' THEN 3
    END AS min_lvl
  ),
  seed AS (
    SELECT _resource_id AS id, NULL::uuid AS folder_id, (SELECT parent_id FROM public.folders WHERE id = _resource_id) AS parent_id
    WHERE _resource_type = 'folder'
    UNION ALL
    SELECT
      _resource_id,
      CASE _resource_type
        WHEN 'task' THEN (SELECT folder_id FROM public.tasks WHERE id = _resource_id)
        WHEN 'note' THEN (SELECT folder_id FROM public.notes WHERE id = _resource_id)
        ELSE NULL
      END,
      CASE _resource_type
        WHEN 'task' THEN (SELECT parent_id FROM public.tasks WHERE id = _resource_id)
        ELSE NULL
      END
    WHERE _resource_type IN ('task', 'note')
  ),
  chain(id, folder_id, parent_id, depth) AS (
    SELECT id, folder_id, parent_id, 0 FROM seed
    UNION ALL
    -- Walk up parent tasks
    SELECT t.id, t.folder_id, t.parent_id, c.depth + 1
    FROM public.tasks t
    JOIN chain c ON t.id = c.parent_id
    WHERE c.depth < 10
    UNION ALL
    -- Walk up folder ancestors for any folder_id encountered
    SELECT f.id, f.parent_id, NULL::uuid, c.depth + 1
    FROM public.folders f
    JOIN chain c ON f.id = c.folder_id
    WHERE c.depth < 10
    UNION ALL
    -- Walk up folder ancestors using the parent_id field (for folder resources and folder rows)
    SELECT f.id, f.parent_id, NULL::uuid, c.depth + 1
    FROM public.folders f
    JOIN chain c ON f.id = c.parent_id
    WHERE c.depth < 10
  )
  SELECT EXISTS (
    SELECT 1 FROM public.shares s, levels, chain c
    WHERE s.recipient_id = _user_id
      AND s.accepted_at IS NOT NULL
      AND (
        -- Direct share on this resource or a parent task/folder
        (s.resource_type = _resource_type AND s.resource_id = c.id)
        -- Folder share covering any folder in the chain
        OR (s.resource_type = 'folder' AND s.resource_id = c.folder_id)
        -- Parent task share for task descendants
        OR (_resource_type = 'task' AND s.resource_type = 'task' AND s.resource_id = c.id AND c.depth > 0)
      )
      AND CASE s.permission WHEN 'view' THEN 1 WHEN 'comment' THEN 2 WHEN 'edit' THEN 3 END >= levels.min_lvl
  );
$$;

-- 2. Effective permission for a user on a resource ('owner' if they own it)
CREATE OR REPLACE FUNCTION public.get_effective_share_permission(
  _user_id uuid,
  _resource_type public.share_resource_type,
  _resource_id uuid
) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  owner_id uuid;
BEGIN
  -- owner?
  IF _resource_type = 'task' THEN
    SELECT user_id INTO owner_id FROM public.tasks WHERE id = _resource_id;
  ELSIF _resource_type = 'note' THEN
    SELECT user_id INTO owner_id FROM public.notes WHERE id = _resource_id;
  ELSIF _resource_type = 'folder' THEN
    SELECT user_id INTO owner_id FROM public.folders WHERE id = _resource_id;
  END IF;

  IF owner_id IS NOT NULL AND owner_id = _user_id THEN
    RETURN 'owner';
  END IF;

  -- Highest permission granted through direct share, folder share, or parent-task share
  IF public.has_share_access(_user_id, _resource_type, _resource_id, 'edit') THEN
    RETURN 'edit';
  END IF;
  IF public.has_share_access(_user_id, _resource_type, _resource_id, 'comment') THEN
    RETURN 'comment';
  END IF;
  IF public.has_share_access(_user_id, _resource_type, _resource_id, 'view') THEN
    RETURN 'view';
  END IF;

  RETURN NULL;
END;
$$;

-- 3. RPC helpers for accept / decline
CREATE OR REPLACE FUNCTION public.accept_share(_share_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _email text;
BEGIN
  SELECT lower(email) INTO _email FROM auth.users WHERE id = auth.uid();
  UPDATE public.shares
  SET accepted_at = now(), recipient_id = coalesce(recipient_id, auth.uid())
  WHERE id = _share_id
    AND accepted_at IS NULL
    AND (
      recipient_id = auth.uid()
      OR lower(recipient_email) = _email
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.decline_share(_share_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _email text;
BEGIN
  SELECT lower(email) INTO _email FROM auth.users WHERE id = auth.uid();
  DELETE FROM public.shares
  WHERE id = _share_id
    AND (
      recipient_id = auth.uid()
      OR lower(recipient_email) = _email
      OR owner_id = auth.uid()
    );
END;
$$;

-- 4. When a share is created, link it to an existing user by email but keep it pending
CREATE OR REPLACE FUNCTION public.link_share_recipient()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid;
BEGIN
  IF NEW.recipient_id IS NULL THEN
    SELECT id INTO uid FROM auth.users WHERE lower(email) = lower(NEW.recipient_email) LIMIT 1;
    IF uid IS NOT NULL THEN
      NEW.recipient_id := uid;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_share_recipient ON public.shares;
CREATE TRIGGER trg_link_share_recipient
BEFORE INSERT ON public.shares
FOR EACH ROW EXECUTE FUNCTION public.link_share_recipient();

-- 5. New users no longer auto-accept; they still get linked to pending shares
CREATE OR REPLACE FUNCTION public.link_shares_on_signup()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.shares
  SET recipient_id = NEW.id
  WHERE recipient_id IS NULL
    AND lower(recipient_email) = lower(NEW.email);
  RETURN NEW;
END;
$$;

-- 6. Recipients can view shares (including pending) and owners can manage them
DROP POLICY IF EXISTS "Recipients view their shares" ON public.shares;
CREATE POLICY "Recipients view their shares" ON public.shares
  FOR SELECT USING (
    owner_id = auth.uid()
    OR recipient_id = auth.uid()
    OR lower(recipient_email) = lower((select email from auth.users where id = auth.uid()))
  );

DROP POLICY IF EXISTS "Owners manage shares" ON public.shares;
CREATE POLICY "Owners manage shares" ON public.shares
  FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- 7. Subtasks inherit task share permission (view/comment)
ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Recipients view shared subtasks" ON public.subtasks;
CREATE POLICY "Recipients view shared subtasks" ON public.subtasks
  FOR SELECT USING (public.has_share_access(auth.uid(), 'task', task_id, 'view'));

DROP POLICY IF EXISTS "Recipients with comment can create subtasks" ON public.subtasks;
CREATE POLICY "Recipients with comment can create subtasks" ON public.subtasks
  FOR INSERT WITH CHECK (public.has_share_access(auth.uid(), 'task', task_id, 'comment'));

DROP POLICY IF EXISTS "Recipients with comment can update subtasks" ON public.subtasks;
CREATE POLICY "Recipients with comment can update subtasks" ON public.subtasks
  FOR UPDATE USING (public.has_share_access(auth.uid(), 'task', task_id, 'comment'));

-- 8. Enforce permission semantics at the DB level for tasks
--    comment: only completion status; edit: full update; owner: always allowed
CREATE OR REPLACE FUNCTION public.enforce_task_share_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.user_id = auth.uid() THEN
    RETURN NEW;
  END IF;
  IF public.has_share_access(auth.uid(), 'task', NEW.id, 'edit') THEN
    RETURN NEW;
  END IF;
  IF public.has_share_access(auth.uid(), 'task', NEW.id, 'comment') THEN
    IF NEW.completed IS DISTINCT FROM OLD.completed OR NEW.completed_at IS DISTINCT FROM OLD.completed_at THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'comment permission can only update completion';
  END IF;
  RAISE EXCEPTION 'no permission to update this task';
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_task_share_update ON public.tasks;
CREATE TRIGGER trg_enforce_task_share_update
BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.enforce_task_share_update();

-- 9. One-time link for any legacy shares created before this migration
UPDATE public.shares s
SET recipient_id = u.id
FROM auth.users u
WHERE s.recipient_id IS NULL
  AND lower(s.recipient_email) = lower(u.email);
