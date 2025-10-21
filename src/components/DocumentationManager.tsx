import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FileText, Plus, Trash2 } from "lucide-react";

type Doc = {
  id: string;
  title: string;
  content: string;
  doc_type: string;
  created_at: string;
};

export const DocumentationManager = () => {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [docType, setDocType] = useState("guideline");
  const { toast } = useToast();

  useEffect(() => {
    loadDocs();
  }, []);

  const loadDocs = async () => {
    const { data } = await supabase
      .from("documentation")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setDocs(data);
  };

  const addDoc = async () => {
    if (!title.trim() || !content.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide both title and content",
        variant: "destructive",
      });
      return;
    }

    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;

    const { data: doc, error } = await supabase
      .from("documentation")
      .insert({
        user_id: user.user.id,
        title,
        content,
        doc_type: docType,
      })
      .select()
      .single();

    if (error) {
      toast({
        title: "Failed to add documentation",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    // Generate embedding
    await supabase.functions.invoke("generate-embeddings", {
      body: {
        text: `${title}\n\n${content}`,
        type: "documentation",
        referenceId: doc.id,
      },
    });

    toast({ title: "Documentation added successfully" });
    setTitle("");
    setContent("");
    setIsAdding(false);
    loadDocs();
  };

  const deleteDoc = async (id: string) => {
    const { error } = await supabase
      .from("documentation")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Failed to delete",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Documentation deleted" });
    loadDocs();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Knowledge Base
        </h3>
        <Button onClick={() => setIsAdding(!isAdding)} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Documentation
        </Button>
      </div>

      {isAdding && (
        <Card className="p-4 space-y-4">
          <Input
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Select value={docType} onValueChange={setDocType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="guideline">Guideline</SelectItem>
              <SelectItem value="schema_doc">Schema Documentation</SelectItem>
              <SelectItem value="best_practice">Best Practice</SelectItem>
            </SelectContent>
          </Select>
          <Textarea
            placeholder="Content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
          />
          <div className="flex gap-2">
            <Button onClick={addDoc}>Save</Button>
            <Button variant="outline" onClick={() => setIsAdding(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      <div className="space-y-2">
        {docs.map((doc) => (
          <Card key={doc.id} className="p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h4 className="font-semibold">{doc.title}</h4>
                <p className="text-sm text-muted-foreground mt-1">{doc.content}</p>
                <span className="text-xs text-muted-foreground mt-2 inline-block">
                  {doc.doc_type.replace("_", " ")}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteDoc(doc.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
