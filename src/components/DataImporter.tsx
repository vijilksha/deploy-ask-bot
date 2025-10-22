import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, Database } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const DataImporter = () => {
  const [tableName, setTableName] = useState("");
  const [sqlData, setSqlData] = useState("");
  const [csvData, setCsvData] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const { toast } = useToast();

  const parseSQLInserts = (sql: string): { columns: string[]; rows: any[] } => {
    // Extract table name and parse INSERT statements
    const insertRegex = /INSERT\s+INTO\s+\w+\s*\((.*?)\)\s*VALUES\s*\((.*?)\)/gi;
    let match;
    const rows: any[] = [];
    let columns: string[] = [];

    while ((match = insertRegex.exec(sql)) !== null) {
      if (columns.length === 0) {
        columns = match[1].split(',').map(col => col.trim().replace(/[`'"]/g, ''));
      }
      
      const values = match[2].split(',').map(val => {
        val = val.trim().replace(/^['"]|['"]$/g, '');
        // Handle NULL
        if (val.toUpperCase() === 'NULL') return null;
        // Try to parse numbers
        if (!isNaN(Number(val))) return Number(val);
        return val;
      });
      
      const row: any = {};
      columns.forEach((col, idx) => {
        row[col] = values[idx];
      });
      rows.push(row);
    }

    return { columns, rows };
  };

  const parseCSV = (csv: string): { columns: string[]; rows: any[] } => {
    const lines = csv.trim().split('\n');
    const columns = lines[0].split(',').map(col => col.trim());
    const rows: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(val => val.trim());
      const row: any = {};
      columns.forEach((col, idx) => {
        const value = values[idx];
        // Try to parse numbers
        if (!isNaN(Number(value)) && value !== '') {
          row[col] = Number(value);
        } else if (value.toLowerCase() === 'null' || value === '') {
          row[col] = null;
        } else {
          row[col] = value;
        }
      });
      rows.push(row);
    }

    return { columns, rows };
  };

  const handleImport = async (type: 'sql' | 'csv') => {
    if (!tableName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a table name",
        variant: "destructive",
      });
      return;
    }

    const data = type === 'sql' ? sqlData : csvData;
    if (!data.trim()) {
      toast({
        title: "Error",
        description: `Please enter ${type.toUpperCase()} data`,
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);

    try {
      const { columns, rows } = type === 'sql' ? parseSQLInserts(data) : parseCSV(data);

      if (rows.length === 0) {
        throw new Error("No data rows found");
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create table definition
      const schemaDefinition = {
        columns: columns.map(col => ({
          name: col,
          type: "text" // For simplicity, store everything as text initially
        }))
      };

      // Insert table metadata
      const { data: tableData, error: tableError } = await supabase
        .from("imported_tables")
        .insert({
          user_id: user.id,
          table_name: tableName,
          schema_definition: schemaDefinition,
        })
        .select()
        .single();

      if (tableError) throw tableError;

      // Insert all data rows
      const dataRows = rows.map(row => ({
        user_id: user.id,
        table_id: tableData.id,
        row_data: row,
      }));

      const { error: dataError } = await supabase
        .from("imported_data")
        .insert(dataRows);

      if (dataError) throw dataError;

      toast({
        title: "Success",
        description: `Imported ${rows.length} rows into table "${tableName}"`,
      });

      // Clear form
      setTableName("");
      setSqlData("");
      setCsvData("");
    } catch (error: any) {
      console.error("Import error:", error);
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Import Your Database
        </CardTitle>
        <CardDescription>
          Import data from your MySQL database to query it directly in the app
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Table Name:</label>
            <Input
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="e.g., Movie, Users, Products"
              className="mt-1"
            />
          </div>

          <Tabs defaultValue="sql">
            <TabsList className="w-full">
              <TabsTrigger value="sql" className="flex-1">
                <Database className="w-4 h-4 mr-2" />
                SQL Inserts
              </TabsTrigger>
              <TabsTrigger value="csv" className="flex-1">
                CSV Data
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sql" className="space-y-3">
              <div>
                <label className="text-sm font-medium">Paste SQL INSERT statements:</label>
                <Textarea
                  value={sqlData}
                  onChange={(e) => setSqlData(e.target.value)}
                  placeholder="INSERT INTO Movie (id, title, year) VALUES (1, 'Inception', 2010);"
                  className="mt-1 min-h-48 font-mono text-sm"
                />
              </div>
              <Button 
                onClick={() => handleImport('sql')} 
                disabled={isImporting}
                className="w-full"
              >
                {isImporting ? "Importing..." : "Import SQL Data"}
              </Button>
            </TabsContent>

            <TabsContent value="csv" className="space-y-3">
              <div>
                <label className="text-sm font-medium">Paste CSV data (comma-separated):</label>
                <Textarea
                  value={csvData}
                  onChange={(e) => setCsvData(e.target.value)}
                  placeholder="id,title,year\n1,Inception,2010\n2,The Matrix,1999"
                  className="mt-1 min-h-48 font-mono text-sm"
                />
              </div>
              <Button 
                onClick={() => handleImport('csv')} 
                disabled={isImporting}
                className="w-full"
              >
                {isImporting ? "Importing..." : "Import CSV Data"}
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </CardContent>
    </Card>
  );
};
