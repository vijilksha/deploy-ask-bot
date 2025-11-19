import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";

interface ExcelUploaderProps {
  onUploadComplete: () => void;
}

export const ExcelUploader = ({ onUploadComplete }: ExcelUploaderProps) => {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      console.log("Parsed Excel data:", jsonData);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      // Map Excel columns to database columns
      const contacts = jsonData.map((row: any) => ({
        user_id: user?.id || "",
        empid: row.empid || row.EmpID || "",
        fullname: row.fullname || row.FullName || "",
        name: row.fullname || row.FullName || "", // Keep for compatibility
        email: row.email || row.Email || "",
        type_of_hire: row["type of hire"] || row.type_of_hire || "",
        cohort_code: row["cohort code"] || row.cohort_code || "",
        project: row.project || row.Project || "",
        role_assigned: row["role assigned"] || row.role_assigned || "",
        comments: row.comments || row.Comments || "",
        billable_status: row["billable status"] || row.billable_status || "",
        account_name: row["account name"] || row.account_name || "",
        eid: row.eid || row.EID || "",
        edl_comments_on_nbl: row["edl comments on NBL"] || row.edl_comments_on_nbl || "",
        edl_comments_on_role: row["edl commentts on role"] || row.edl_comments_on_role || "",
        deployment_status: "pending",
      }));

      console.log("Mapped contacts:", contacts);

      // Insert into database
      const { error } = await supabase.from("contacts").insert(contacts);

      if (error) throw error;

      toast({
        title: "Success!",
        description: `Uploaded ${contacts.length} contacts from Excel.`,
      });

      onUploadComplete();
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to upload Excel file",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="flex items-center gap-4">
      <Input
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileUpload}
        disabled={uploading}
        className="max-w-xs"
        id="excel-upload"
      />
      <Button disabled={uploading} variant="outline" asChild>
        <label htmlFor="excel-upload" className="cursor-pointer">
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload Excel
            </>
          )}
        </label>
      </Button>
    </div>
  );
};