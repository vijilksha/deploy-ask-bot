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
import { Mail, Trash2, Plus, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface Contact {
  id: string;
  name: string;
  email: string;
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
  const [newContact, setNewContact] = useState({ name: "", email: "" });
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const { toast } = useToast();

  const handleSendEmail = async (contact: Contact) => {
    setSendingEmail(contact.id);
    try {
      const { data, error } = await supabase.functions.invoke("send-deployment-email", {
        body: { name: contact.name, email: contact.email },
      });

      if (error) throw error;

      await supabase
        .from("contacts")
        .update({ email_sent_at: new Date().toISOString() })
        .eq("id", contact.id);

      toast({
        title: "Email sent!",
        description: `Reminder email sent to ${contact.name}`,
      });
      onRefresh();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send email",
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

  const handleUpdateResponse = async (id: string, response: string) => {
    try {
      const { error } = await supabase
        .from("contacts")
        .update({ response })
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
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Email Sent</TableHead>
                <TableHead>Response</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No contacts yet. Add your first contact to get started.
                  </TableCell>
                </TableRow>
              ) : (
                contacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell className="font-medium">{contact.name}</TableCell>
                    <TableCell>{contact.email}</TableCell>
                    <TableCell>
                      <Badge variant={contact.deployment_status === "deployed" ? "default" : "secondary"}>
                        {contact.deployment_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {contact.email_sent_at
                        ? new Date(contact.email_sent_at).toLocaleDateString()
                        : "Not sent"}
                    </TableCell>
                    <TableCell>
                      <Textarea
                        value={contact.response || ""}
                        onChange={(e) => handleUpdateResponse(contact.id, e.target.value)}
                        placeholder="Add response..."
                        className="min-h-[60px]"
                      />
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        onClick={() => handleSendEmail(contact)}
                        disabled={sendingEmail === contact.id}
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
