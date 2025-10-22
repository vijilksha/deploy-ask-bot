import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Loader2, Send, Code, BookOpen, Zap, Table, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Table as UITable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Message = {
  role: "user" | "assistant";
  content: string;
  sqlQuery?: string;
  queryResults?: any;
  insights?: string;
};

type Mode = "chat" | "generate" | "explain" | "optimize";

export const SQLChat = ({ 
  conversationId, 
  schemaId 
}: { 
  conversationId: string;
  schemaId: string | null;
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("chat");
  const [schemaDefinition, setSchemaDefinition] = useState(null);
  const [useRAG, setUseRAG] = useState(true);
  const [currentSQLQuery, setCurrentSQLQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadMessages();
    if (schemaId) loadSchema();
  }, [conversationId, schemaId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadSchema = async () => {
    if (!schemaId) return;
    const { data } = await supabase
      .from("database_schemas")
      .select("schema_definition")
      .eq("id", schemaId)
      .single();
    
    if (data) setSchemaDefinition(data.schema_definition);
  };

  const loadMessages = () => {
    // Messages are now stored only in component state, not persisted
    // Load from localStorage for the conversation if needed
    const stored = localStorage.getItem(`messages_${conversationId}`);
    if (stored) {
      setMessages(JSON.parse(stored));
    }
  };

  const saveMessage = (role: "user" | "assistant", content: string, sqlQuery?: string) => {
    // Save to localStorage instead of database
    const updated = [...messages, { role, content, sqlQuery }];
    localStorage.setItem(`messages_${conversationId}`, JSON.stringify(updated));
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    localStorage.setItem(`messages_${conversationId}`, JSON.stringify(updatedMessages));
    
    const userInput = input;
    setInput("");
    setIsLoading(true);

    try {
      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sql-ai-chat`;
      
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          schemaDefinition,
          mode,
          includeRAG: useRAG,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get response");
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      let textBuffer = "";
      let streamDone = false;

      const updateAssistant = (chunk: string) => {
        assistantContent += chunk;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => 
              i === prev.length - 1 ? { ...m, content: assistantContent } : m
            );
          }
          return [...prev, { role: "assistant", content: assistantContent }];
        });
      };

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              updateAssistant(content);
              // Extract SQL if in generate mode
              if (mode === "generate" && content.includes("SELECT")) {
                setCurrentSQLQuery(prev => prev + content);
              }
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      if (assistantContent) {
        // If in generate mode, automatically execute the SQL on imported data
        if (mode === "generate" && assistantContent.includes("SELECT")) {
          try {
            // Extract SQL query from response
            const sqlMatch = assistantContent.match(/```sql\n([\s\S]+?)\n```/) || 
                            assistantContent.match(/```\n([\s\S]+?)\n```/);
            const sqlQuery = sqlMatch ? sqlMatch[1].trim() : assistantContent.trim();
            
            // Execute the query on imported data
            const executeResponse = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/query-imported-data`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
                },
                body: JSON.stringify({ query: sqlQuery }),
              }
            );
            
            const executeResult = await executeResponse.json();
            
            if (executeResult.status === "success") {
              // Update the last assistant message with results
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  sqlQuery,
                  queryResults: executeResult.data,
                  insights: executeResult.insights,
                };
                return updated;
              });
              
              toast({
                title: "Query executed successfully",
                description: `${executeResult.rowCount} rows returned`,
              });
            } else {
              toast({
                title: "Query execution note",
                description: executeResult.error,
                variant: "destructive",
              });
            }
          } catch (execError) {
            console.error("Execution error:", execError);
          }
        }
        
        // Save final message to localStorage
        const finalMessages = [...messages, userMessage, { role: "assistant" as const, content: assistantContent }];
        localStorage.setItem(`messages_${conversationId}`, JSON.stringify(finalMessages));
      }
    } catch (error: any) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-2 p-4 border-b flex-wrap">
        <Button
          variant={mode === "chat" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("chat")}
        >
          Chat
        </Button>
        <Button
          variant={mode === "generate" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("generate")}
        >
          <Code className="w-4 h-4 mr-2" />
          Generate SQL
        </Button>
        <Button
          variant={mode === "explain" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("explain")}
        >
          <BookOpen className="w-4 h-4 mr-2" />
          Explain
        </Button>
        <Button
          variant={mode === "optimize" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("optimize")}
        >
          <Zap className="w-4 h-4 mr-2" />
          Optimize
        </Button>
        <Button
          variant={useRAG ? "default" : "outline"}
          size="sm"
          onClick={() => setUseRAG(!useRAG)}
        >
          RAG {useRAG ? "On" : "Off"}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <Card
            key={idx}
            className={`p-4 ${
              msg.role === "user" 
                ? "bg-primary/10 ml-auto max-w-[80%]" 
                : "bg-muted max-w-full"
            }`}
          >
            <pre className="whitespace-pre-wrap font-sans text-sm">{msg.content}</pre>
            
            {msg.queryResults && msg.queryResults.length > 0 && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Table className="w-4 h-4" />
                  Query Results ({msg.queryResults.length} rows)
                </div>
                <div className="border rounded-lg overflow-auto max-h-96">
                  <UITable>
                    <TableHeader>
                      <TableRow>
                        {Object.keys(msg.queryResults[0]).map((key) => (
                          <TableHead key={key}>{key}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {msg.queryResults.slice(0, 100).map((row: any, rowIdx: number) => (
                        <TableRow key={rowIdx}>
                          {Object.values(row).map((value: any, colIdx: number) => (
                            <TableCell key={colIdx}>
                              {value !== null ? String(value) : "NULL"}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </UITable>
                </div>
                
                {msg.insights && (
                  <div className="mt-3 p-3 bg-accent/50 rounded-lg">
                    <div className="text-sm font-semibold mb-1">💡 Insights:</div>
                    <div className="text-sm whitespace-pre-wrap">{msg.insights}</div>
                  </div>
                )}
              </div>
            )}
            
            {msg.role === "assistant" && msg.content.includes("```sql") && (
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => {
                  const sqlMatch = msg.content.match(/```sql\n([\s\S]+?)\n```/) || 
                                  msg.content.match(/```\n([\s\S]+?)\n```/);
                  if (sqlMatch) {
                    navigator.clipboard.writeText(sqlMatch[1]);
                    toast({
                      title: "Copied!",
                      description: "SQL query copied to clipboard",
                    });
                  }
                }}
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy SQL
              </Button>
            )}
          </Card>
        ))}
        {isLoading && (
          <Card className="p-4 bg-muted max-w-[80%]">
            <Loader2 className="w-4 h-4 animate-spin" />
          </Card>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              mode === "generate" 
                ? "Describe the query you want... (e.g., 'Show all users who signed up last month')"
                : mode === "explain"
                ? "Paste a SQL query to explain..."
                : mode === "optimize"
                ? "Paste a SQL query to optimize..."
                : "Ask anything about your database..."
            }
            className="flex-1 min-h-[60px]"
            disabled={isLoading}
          />
          <Button onClick={handleSend} disabled={isLoading || !input.trim()}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
};
