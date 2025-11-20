import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Mail, Trash2, Plus, Loader2, Send } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

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

interface ContactsTableProps {
  contacts: Contact[];
  onRefresh: () => void;
}

export const ContactsTable = ({ contacts, onRefresh }: ContactsTableProps) => {
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [sendingBulk, setSendingBulk] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", email: "" });
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const { toast } = useToast();

  const handleSendBulkEmails = async () => {
    if (contacts.length === 0) {
      toast({
        title: "No contacts",
        description: "No contacts to send emails to",
        variant: "destructive",
      });
      return;
    }

    setSendingBulk(true);
    try {
      const contactIds = contacts.map(c => c.id);
      
      const { data, error } = await supabase.functions.invoke("send-bulk-emails", {
        body: { contactIds },
      });

      if (error) throw error;

      toast({
        title: "Bulk emails sent!",
        description: data.message,
      });
      onRefresh();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send bulk emails",
        variant: "destructive",
      });
    } finally {
      setSendingBulk(false);
    }
  };

  const handleSendTeamsMessage = async (contact: Contact) => {
    setSendingEmail(contact.id);
    try {
      const { data, error } = await supabase.functions.invoke("send-teams-message", {
        body: { 
          eid: contact.eid,
          contactId: contact.id,
          fullname: contact.fullname || contact.name,
          project: contact.project,
          role_assigned: contact.role_assigned,
        },
      });

      if (error) throw error;

      toast({
        title: "Teams message sent!",
        description: `Message sent to ${contact.eid} for ${contact.fullname || contact.name}`,
      });
      onRefresh();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send Teams message",
        variant: "destructive",
      });
    } finally {
      setSendingEmail(null);
    }
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAddingContact(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("contacts").insert({
        user_id: user.id,
        name: newContact.name,
        email: newContact.email,
        deployment_status: "pending",
      });

      if (error) throw error;

      toast({
        title: "Contact added!",
        description: `${newContact.name} has been added to your contacts.`,
      });
      setNewContact({ name: "", email: "" });
      setOpenDialog(false);
      onRefresh();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsAddingContact(false);
    }
  };

  const handleDeleteContact = async (id: string) => {
    try {
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw error;

      toast({
        title: "Contact deleted",
        description: "The contact has been removed.",
      });
      onRefresh();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleUpdateResponse = async (id: string, edl_comments_on_role: string) => {
    try {
      const { error } = await supabase
        .from("contacts")
        .update({ edl_comments_on_role })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Response updated",
        description: "The response has been saved.",
      });
      onRefresh();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Deployment Contacts</CardTitle>
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Contact
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Contact</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddContact} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={newContact.name}
                  onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                  placeholder="John Doe"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newContact.email}
                  onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                  placeholder="john@example.com"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isAddingContact}>
                {isAddingContact ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add Contact"
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex justify-end">
          <Button 
            onClick={handleSendBulkEmails} 
            disabled={sendingBulk || contacts.length === 0}
            size="lg"
          >
            {sendingBulk ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending to {contacts.length} contacts...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Bulk Emails ({contacts.length})
              </>
            )}
          </Button>
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>EmpID</TableHead>
                <TableHead>Full Name</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>EID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>EDL Comments</TableHead>
                <TableHead>Email Reply</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    No contacts yet. Upload an Excel file to get started.
                  </TableCell>
                </TableRow>
              ) : (
                contacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell className="font-medium">{contact.empid}</TableCell>
                    <TableCell>{contact.fullname || contact.name}</TableCell>
                    <TableCell>{contact.project}</TableCell>
                    <TableCell>{contact.role_assigned}</TableCell>
                    <TableCell>{contact.eid}</TableCell>
                    <TableCell>
                      <Badge variant={contact.deployment_status === "deployed" ? "default" : "secondary"}>
                        {contact.deployment_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Textarea
                        value={contact.edl_comments_on_role || ""}
                        onChange={(e) => handleUpdateResponse(contact.id, e.target.value)}
                        placeholder="Awaiting response..."
                        className="min-h-[60px]"
                      />
                    </TableCell>
                    <TableCell>
                      <Textarea
                        value={contact.response || ""}
                        onChange={(e) => handleUpdateResponse(contact.id, e.target.value)}
                        placeholder="Email reply will appear here..."
                        className="min-h-[60px]"
                        disabled
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSendTeamsMessage(contact)}
                          disabled={sendingEmail === contact.id || !contact.eid}
                          title={!contact.eid ? "No EID provided" : "Send Teams message"}
                        >
                          {sendingEmail === contact.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Mail className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteContact(contact.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
