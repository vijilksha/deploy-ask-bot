import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Database, Loader2 } from "lucide-react";

interface DatabaseConnectionProps {
  onConnect: (connectionInfo: DatabaseConnectionInfo) => void;
}

export interface DatabaseConnectionInfo {
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
}

export const DatabaseConnection = ({ onConnect }: DatabaseConnectionProps) => {
  const [host, setHost] = useState("localhost");
  const [port, setPort] = useState("5432");
  const [database, setDatabase] = useState("");
  const [username, setUsername] = useState("postgres");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const connectionInfo = {
        host,
        port,
        database,
        username,
        password,
      };

      // Store connection info in localStorage
      localStorage.setItem("dbConnection", JSON.stringify(connectionInfo));

      toast({
        title: "Connected!",
        description: `Successfully connected to database: ${database}`,
      });

      onConnect(connectionInfo);
    } catch (error: any) {
      toast({
        title: "Connection Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Database Connection</CardTitle>
          <CardDescription>
            Connect to your local PostgreSQL database
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="host">Host</Label>
              <div className="relative">
                <Database className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="host"
                  type="text"
                  placeholder="localhost"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">Port</Label>
              <Input
                id="port"
                type="text"
                placeholder="5432"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="database">Database Name</Label>
              <Input
                id="database"
                type="text"
                placeholder="mydb"
                value={database}
                onChange={(e) => setDatabase(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="postgres"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect to Database"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
