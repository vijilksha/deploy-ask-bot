-- Create a flexible table to store imported data
-- Users can store their own tables' data here
CREATE TABLE IF NOT EXISTS public.imported_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  table_name TEXT NOT NULL,
  schema_definition JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create a table to store the actual data rows
CREATE TABLE IF NOT EXISTS public.imported_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  table_id UUID NOT NULL REFERENCES public.imported_tables(id) ON DELETE CASCADE,
  row_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.imported_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imported_data ENABLE ROW LEVEL SECURITY;

-- RLS Policies for imported_tables
CREATE POLICY "Users can view their own imported tables"
  ON public.imported_tables FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own imported tables"
  ON public.imported_tables FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own imported tables"
  ON public.imported_tables FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own imported tables"
  ON public.imported_tables FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for imported_data
CREATE POLICY "Users can view their own imported data"
  ON public.imported_data FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own imported data"
  ON public.imported_data FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own imported data"
  ON public.imported_data FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own imported data"
  ON public.imported_data FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_imported_tables_user_id ON public.imported_tables(user_id);
CREATE INDEX idx_imported_data_user_id ON public.imported_data(user_id);
CREATE INDEX idx_imported_data_table_id ON public.imported_data(table_id);

-- Create trigger for updated_at
CREATE TRIGGER update_imported_tables_updated_at
  BEFORE UPDATE ON public.imported_tables
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();