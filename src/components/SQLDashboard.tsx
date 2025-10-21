import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { SQLChat } from "./SQLChat";
import { SchemaManager } from "./SchemaManager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Database, History, Plus, LogOut } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  const { toast } = useToast();

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      toast({
        title: "Error loading conversations",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setConversations(data || []);
      if (data && data.length > 0 && !activeConversation) {
        setActiveConversation(data[0].id);
        setActiveSchema(data[0].schema_id);
      }
    }
  };

  const createConversation = async (schemaId?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("conversations")
      .insert({
        user_id: user.id,
        title: "New Conversation",
        schema_id: schemaId || null,
      })
      .select()
      .single();

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else if (data) {
      setConversations([data, ...conversations]);
      setActiveConversation(data.id);
      setActiveSchema(data.schema_id);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
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
          <h1 className="text-xl font-bold">SQL AI Assistant</h1>
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
          <Button variant="outline" onClick={handleSignOut} className="w-full">
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
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
            <TabsTrigger value="schemas">
              <Database className="w-4 h-4 mr-2" />
              Schemas
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="w-4 h-4 mr-2" />
              History
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

          <TabsContent value="history" className="flex-1 m-0 p-6 overflow-y-auto">
            <Card>
              <CardHeader>
                <CardTitle>Query History</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Your query history will appear here. Execute queries from conversations to build your history.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
