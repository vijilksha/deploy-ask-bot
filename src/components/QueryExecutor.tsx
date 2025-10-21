import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Play, Loader2, AlertCircle, Lightbulb } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

type QueryResult = {
  data: any[];
  rowCount: number;
  status: string;
  insights?: string;
  error?: string;
};

export const QueryExecutor = ({ 
  sqlQuery, 
  conversationId 
}: { 
  sqlQuery: string;
  conversationId: string;
}) => {
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const { toast } = useToast();

  const executeQuery = async () => {
    setIsExecuting(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("execute-sql", {
        body: {
          query: sqlQuery,
          conversationId,
        },
      });

      if (error) throw error;

      setResult(data);

      if (data.status === "success") {
        toast({
          title: "Query executed successfully",
          description: `${data.rowCount} rows returned`,
        });
      }
    } catch (error: any) {
      console.error("Execution error:", error);
      setResult({
        data: [],
        rowCount: 0,
        status: "failed",
        error: error.message,
      });
      toast({
        title: "Execution failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button
        onClick={executeQuery}
        disabled={isExecuting || !sqlQuery.trim()}
        className="w-full"
      >
        {isExecuting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Executing...
          </>
        ) : (
          <>
            <Play className="w-4 h-4 mr-2" />
            Execute Query
          </>
        )}
      </Button>

      {result && (
        <>
          {result.status === "failed" && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{result.error}</AlertDescription>
            </Alert>
          )}

          {result.status === "success" && result.insights && (
            <Alert>
              <Lightbulb className="h-4 w-4" />
              <AlertDescription>
                <strong>AI Insights:</strong> {result.insights}
              </AlertDescription>
            </Alert>
          )}

          {result.status === "success" && result.data.length > 0 && (
            <Card className="p-4 overflow-auto max-h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    {Object.keys(result.data[0]).map((key) => (
                      <TableHead key={key}>{key}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.data.map((row, idx) => (
                    <TableRow key={idx}>
                      {Object.values(row).map((value: any, cellIdx) => (
                        <TableCell key={cellIdx}>
                          {typeof value === "object" ? JSON.stringify(value) : String(value)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}

          {result.status === "success" && result.data.length === 0 && (
            <Alert>
              <AlertDescription>Query executed successfully but returned no rows.</AlertDescription>
            </Alert>
          )}
        </>
      )}
    </div>
  );
};
