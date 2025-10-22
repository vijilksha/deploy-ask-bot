import { useState, useEffect } from "react";
import { DatabaseConnection, DatabaseConnectionInfo } from "@/components/DatabaseConnection";
import Index from "./Index";

const IndexWrapper = () => {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if connection info exists in localStorage
    const connectionInfo = localStorage.getItem("dbConnection");
    if (connectionInfo) {
      setConnected(true);
    }
    setLoading(false);
  }, []);

  const handleConnect = (connectionInfo: DatabaseConnectionInfo) => {
    setConnected(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return connected ? <Index /> : <DatabaseConnection onConnect={handleConnect} />;
};

export default IndexWrapper;
