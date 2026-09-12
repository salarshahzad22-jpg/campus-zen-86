CREATE TABLE public.class_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id uuid NOT NULL,
  title text NOT NULL,
  subject text NOT NULL,
  description text,
  due_date date,
  max_marks numeric NOT NULL DEFAULT 100,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_assignments TO authenticated;
GRANT ALL ON public.class_assignments TO service_role;
ALTER TABLE public.class_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage class assignments" ON public.class_assignments
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "read published class assignments" ON public.class_assignments
  FOR SELECT TO authenticated
  USING (published OR private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_class_assignments_updated_at
  BEFORE UPDATE ON public.class_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_assignment_id uuid REFERENCES public.class_assignments(id) ON DELETE CASCADE,
  assignment_id uuid REFERENCES public.assignments(id) ON DELETE CASCADE,
  title text NOT NULL,
  subject text NOT NULL,
  content text,
  link_url text,
  file_path text,
  file_name text,
  status text NOT NULL DEFAULT 'submitted',
  marks numeric,
  max_marks numeric NOT NULL DEFAULT 100,
  feedback text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT submissions_status_check CHECK (status IN ('submitted','approved','needs_changes','graded'))
);

CREATE INDEX submissions_user_id_idx ON public.submissions(user_id);
CREATE INDEX submissions_status_idx ON public.submissions(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.submissions TO authenticated;
GRANT ALL ON public.submissions TO service_role;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "students read own submissions" ON public.submissions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "students create own submissions" ON public.submissions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'submitted' AND marks IS NULL);

CREATE POLICY "students edit own open submissions" ON public.submissions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status IN ('submitted','needs_changes'))
  WITH CHECK (auth.uid() = user_id AND status IN ('submitted','needs_changes'));

CREATE POLICY "students delete own open submissions" ON public.submissions
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND status IN ('submitted','needs_changes'));

CREATE POLICY "admins manage submissions" ON public.submissions
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_submissions_updated_at
  BEFORE UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "students manage own submission files" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'submissions' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'submissions' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "admins read submission files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'submissions' AND private.has_role(auth.uid(), 'admin'::app_role));