import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Database } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Schema = {
  id: string;
  name: string;
  description: string;
  schema_definition: any;
};

export const SchemaManager = ({ 
  onSchemaSelect 
}: { 
  onSchemaSelect: (schemaId: string) => void;
}) => {
  const [schemas, setSchemas] = useState<Schema[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    schemaText: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    loadSchemas();
  }, []);

  const loadSchemas = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("database_schemas")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error loading schemas",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setSchemas(data || []);
    }
  };

  const handleSaveSchema = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Parse the schema text as JSON
      const schemaDefinition = JSON.parse(formData.schemaText);

      const { error } = await supabase.from("database_schemas").insert({
        user_id: user.id,
        name: formData.name,
        description: formData.description,
        schema_definition: schemaDefinition,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Schema saved successfully",
      });

      setIsDialogOpen(false);
      setFormData({ name: "", description: "", schemaText: "" });
      loadSchemas();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteSchema = async (id: string) => {
    const { error } = await supabase
      .from("database_schemas")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Schema deleted",
      });
      loadSchemas();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Database Schemas</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Schema
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Database Schema</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Schema Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="My Database Schema"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Production database schema"
                />
              </div>
              <div>
                <Label htmlFor="schema">Schema Definition (JSON)</Label>
                <Textarea
                  id="schema"
                  value={formData.schemaText}
                  onChange={(e) => setFormData({ ...formData, schemaText: e.target.value })}
                  placeholder={`{
  "tables": [
    {
      "name": "users",
      "columns": [
        {"name": "id", "type": "int", "primary": true},
        {"name": "email", "type": "varchar(255)"},
        {"name": "created_at", "type": "timestamp"}
      ]
    }
  ]
}`}
                  className="font-mono text-sm min-h-[300px]"
                />
              </div>
              <Button onClick={handleSaveSchema} className="w-full">
                Save Schema
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {schemas.map((schema) => (
          <Card 
            key={schema.id} 
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => onSchemaSelect(schema.id)}
          >
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  {schema.name}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteSchema(schema.id);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{schema.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
