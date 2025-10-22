import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { SQLChat } from "./SQLChat";
import { SchemaManager } from "./SchemaManager";
import { QueryExecutor } from "./QueryExecutor";
import { DocumentationManager } from "./DocumentationManager";
import { SimilarQueries } from "./SimilarQueries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Database, History, Plus, LogOut, Play, FileText, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type Conversation = {
  id: string;
  title: string;
  schema_id: string | null;
  created_at: string;
};

export const SQLDashboard = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [activeSchema, setActiveSchema] = useState<string | null>(null);
  const [executorQuery, setExecutorQuery] = useState("");
  const [similarQuery, setSimilarQuery] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = () => {
    const stored = localStorage.getItem("conversations");
    if (stored) {
      const data = JSON.parse(stored);
      setConversations(data);
      if (data.length > 0 && !activeConversation) {
        setActiveConversation(data[0].id);
        setActiveSchema(data[0].schema_id);
      }
    }
  };

  const createConversation = (schemaId?: string) => {
    const newConv: Conversation = {
      id: crypto.randomUUID(),
      title: "New Conversation",
      schema_id: schemaId || null,
      created_at: new Date().toISOString(),
    };

    const updated = [newConv, ...conversations];
    setConversations(updated);
    localStorage.setItem("conversations", JSON.stringify(updated));
    setActiveConversation(newConv.id);
    setActiveSchema(newConv.schema_id);
    
    toast({
      title: "Conversation created",
      description: "New conversation started successfully",
    });
  };

  const handleDisconnect = () => {
    localStorage.removeItem("dbConnection");
    window.location.reload();
  };

  const handleSchemaSelect = (schemaId: string) => {
    setActiveSchema(schemaId);
    createConversation(schemaId);
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-64 border-r bg-muted/10 flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            SQL AI Bot
          </h1>
          <p className="text-xs text-muted-foreground mt-1">RAG-Powered Assistant</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <Button 
            onClick={() => createConversation()} 
            className="w-full mb-4"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Chat
          </Button>

          <div className="space-y-2">
            {conversations.map((conv) => (
              <Card
                key={conv.id}
                className={`cursor-pointer hover:bg-accent transition-colors ${
                  activeConversation === conv.id ? "border-primary" : ""
                }`}
                onClick={() => {
                  setActiveConversation(conv.id);
                  setActiveSchema(conv.schema_id);
                }}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    <span className="text-sm truncate">{conv.title}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="p-4 border-t">
          <Button variant="outline" onClick={handleDisconnect} className="w-full">
            <LogOut className="w-4 h-4 mr-2" />
            Disconnect
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <Tabs defaultValue="chat" className="flex-1 flex flex-col">
          <TabsList className="w-full justify-start rounded-none border-b">
            <TabsTrigger value="chat">
              <MessageSquare className="w-4 h-4 mr-2" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="execute">
              <Play className="w-4 h-4 mr-2" />
              Execute
            </TabsTrigger>
            <TabsTrigger value="knowledge">
              <FileText className="w-4 h-4 mr-2" />
              Knowledge
            </TabsTrigger>
            <TabsTrigger value="similar">
              <History className="w-4 h-4 mr-2" />
              Similar
            </TabsTrigger>
            <TabsTrigger value="schemas">
              <Database className="w-4 h-4 mr-2" />
              Schemas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="flex-1 m-0">
            {activeConversation ? (
              <SQLChat 
                conversationId={activeConversation} 
                schemaId={activeSchema}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <Card className="max-w-md">
                  <CardHeader>
                    <CardTitle>Welcome to SQL AI Assistant</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground mb-4">
                      Start a new conversation or add a database schema to begin.
                    </p>
                    <Button onClick={() => createConversation()} className="w-full">
                      Start New Conversation
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="schemas" className="flex-1 m-0 p-6 overflow-y-auto">
            <SchemaManager onSchemaSelect={handleSchemaSelect} />
          </TabsContent>

          <TabsContent value="execute" className="flex-1 m-0 p-6 overflow-y-auto">
            <Card>
              <CardHeader>
                <CardTitle>Execute SQL Query</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">SQL Query:</label>
                  <Textarea
                    value={executorQuery}
                    onChange={(e) => setExecutorQuery(e.target.value)}
                    className="font-mono text-sm min-h-32"
                    placeholder="Enter or paste SQL query to execute..."
                  />
                </div>
                {activeConversation && (
                  <QueryExecutor 
                    sqlQuery={executorQuery}
                    conversationId={activeConversation}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="knowledge" className="flex-1 m-0 p-6 overflow-y-auto">
            <DocumentationManager />
          </TabsContent>

          <TabsContent value="similar" className="flex-1 m-0 p-6 overflow-y-auto">
            <Card>
              <CardHeader>
                <CardTitle>Find Similar Queries</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Query to find similar:</label>
                  <Textarea
                    value={similarQuery}
                    onChange={(e) => setSimilarQuery(e.target.value)}
                    className="min-h-24"
                    placeholder="Enter a query description to find similar past queries..."
                  />
                </div>
                <SimilarQueries currentQuery={similarQuery} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
