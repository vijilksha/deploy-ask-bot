import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type SimilarQuery = {
  id: string;
  query_text: string;
  usage_count: number;
  similarity: number;
};

export const SimilarQueries = ({ currentQuery }: { currentQuery: string }) => {
  const [similar, setSimilar] = useState<SimilarQuery[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const findSimilar = async () => {
    if (!currentQuery.trim()) return;
    
    setIsLoading(true);
    try {
      const { data } = await supabase.functions.invoke("find-similar", {
        body: {
          query: currentQuery,
          type: "query",
          matchCount: 5,
        },
      });

      if (data?.results) {
        setSimilar(data.results);
      }
    } catch (error) {
      console.error("Error finding similar queries:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        onClick={findSimilar}
        disabled={isLoading || !currentQuery.trim()}
        variant="outline"
        size="sm"
      >
        <History className="w-4 h-4 mr-2" />
        Find Similar Queries
      </Button>

      {similar.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Similar Past Queries:</h4>
          {similar.map((q) => (
            <Card key={q.id} className="p-3">
              <p className="text-sm font-mono">{q.query_text}</p>
              <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                <span>Used {q.usage_count}x</span>
                <span>Similarity: {(q.similarity * 100).toFixed(0)}%</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
