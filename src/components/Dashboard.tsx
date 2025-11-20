import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ContactsTable } from "./ContactsTable";
import { ExcelUploader } from "./ExcelUploader";
import { Button } from "@/components/ui/button";
import { LogOut, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Contact {
  id: string;
  name: string;
  email: string;
  empid?: string;
  fullname?: string;
  type_of_hire?: string;
  cohort_code?: string;
  project?: string;
  role_assigned?: string;
  comments?: string;
  billable_status?: string;
  account_name?: string;
  eid?: string;
  edl_comments_on_nbl?: string;
  edl_comments_on_role?: string;
  deployment_status: string;
  response: string | null;
  email_sent_at: string | null;
  created_at: string;
}

export const Dashboard = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState<Date>();
  const [toDate, setToDate] = useState<Date>();
  const { toast } = useToast();

  const fetchContacts = async () => {
    try {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setContacts(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  useEffect(() => {
    if (!fromDate || !toDate) {
      setFilteredContacts(contacts);
      return;
    }

    const filtered = contacts.filter((contact) => {
      const contactDate = new Date(contact.created_at);
      return contactDate >= fromDate && contactDate <= toDate;
    });
    setFilteredContacts(filtered);
  }, [contacts, fromDate, toDate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Signed out",
      description: "You've been successfully signed out.",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/5">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Deployment Tracker</h1>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6 space-y-4">
          <ExcelUploader onUploadComplete={fetchContacts} />
          
          <div className="flex items-center gap-4 p-4 bg-card rounded-lg border">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">From Date:</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[200px] justify-start text-left font-normal",
                      !fromDate && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {fromDate ? format(fromDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
                    mode="single"
                    selected={fromDate}
                    onSelect={setFromDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">To Date:</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[200px] justify-start text-left font-normal",
                      !toDate && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {toDate ? format(toDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
                    mode="single"
                    selected={toDate}
                    onSelect={setToDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {(fromDate || toDate) && (
              <Button
                variant="ghost"
                onClick={() => {
                  setFromDate(undefined);
                  setToDate(undefined);
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        </div>
        <ContactsTable contacts={filteredContacts} onRefresh={fetchContacts} />
      </main>
    </div>
  );
};
