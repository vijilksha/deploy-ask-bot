-- Phase 2: Enable pgvector for RAG
CREATE EXTENSION IF NOT EXISTS vector;

-- Store query embeddings for similarity search
CREATE TABLE public.query_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_history_id UUID REFERENCES public.query_history(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  query_text TEXT NOT NULL,
  embedding vector(1536),
  usage_count INTEGER DEFAULT 1,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index for similarity search
CREATE INDEX query_embeddings_vector_idx ON public.query_embeddings 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Store documentation for RAG
CREATE TABLE public.documentation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  doc_type TEXT NOT NULL, -- 'guideline', 'schema_doc', 'best_practice'
  embedding vector(1536),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX documentation_vector_idx ON public.documentation 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Phase 3: Visualization and scheduling
CREATE TABLE public.visualizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_history_id UUID REFERENCES public.query_history(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  chart_type TEXT NOT NULL, -- 'bar', 'line', 'pie', 'table'
  config JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.scheduled_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  query_text TEXT NOT NULL,
  schedule_cron TEXT NOT NULL, -- e.g., '0 9 * * 1' for every Monday 9am
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.query_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visualizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_queries ENABLE ROW LEVEL SECURITY;

-- Query embeddings policies
CREATE POLICY "Users can view their own embeddings"
  ON public.query_embeddings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own embeddings"
  ON public.query_embeddings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Documentation policies
CREATE POLICY "Users can view their own documentation"
  ON public.documentation FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own documentation"
  ON public.documentation FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own documentation"
  ON public.documentation FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own documentation"
  ON public.documentation FOR DELETE
  USING (auth.uid() = user_id);

-- Visualization policies
CREATE POLICY "Users can view their own visualizations"
  ON public.visualizations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own visualizations"
  ON public.visualizations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Scheduled queries policies
CREATE POLICY "Users can view their own scheduled queries"
  ON public.scheduled_queries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own scheduled queries"
  ON public.scheduled_queries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scheduled queries"
  ON public.scheduled_queries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scheduled queries"
  ON public.scheduled_queries FOR DELETE
  USING (auth.uid() = user_id);

-- Triggers
CREATE TRIGGER update_documentation_updated_at
  BEFORE UPDATE ON public.documentation
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_scheduled_queries_updated_at
  BEFORE UPDATE ON public.scheduled_queries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to find similar queries
CREATE OR REPLACE FUNCTION public.find_similar_queries(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5,
  target_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  query_text text,
  usage_count int,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    qe.id,
    qe.query_text,
    qe.usage_count,
    1 - (qe.embedding <=> query_embedding) as similarity
  FROM public.query_embeddings qe
  WHERE 
    (target_user_id IS NULL OR qe.user_id = target_user_id)
    AND 1 - (qe.embedding <=> query_embedding) > match_threshold
  ORDER BY qe.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to find similar documentation
CREATE OR REPLACE FUNCTION public.find_similar_docs(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 3,
  target_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  doc_type text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.title,
    d.content,
    d.doc_type,
    1 - (d.embedding <=> query_embedding) as similarity
  FROM public.documentation d
  WHERE 
    (target_user_id IS NULL OR d.user_id = target_user_id)
    AND 1 - (d.embedding <=> query_embedding) > match_threshold
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;