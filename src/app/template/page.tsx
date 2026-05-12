"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Plus,
  Edit,
  Trash2,
  Loader2,
  LayoutTemplate,
  AlertCircle,
} from "lucide-react";
import ConvexUserButton from "@/components/auth/convex-user-button";
import type { Component, PageBackground } from "@/types";
import type { Id } from "../../../convex/_generated/dataModel";

type TemplateType = "quiz" | "result" | "onboarding";

interface Template {
  _id: Id<"templates">;
  title: string;
  description?: string;
  pageName?: string;
  background?: PageBackground;
  components: Component[];
  templateType: TemplateType;
  userId: Id<"users">;
  _creationTime: number;
}

export default function TemplateManagementPage() {
  const router = useRouter();
  const templates = useQuery(api.templates.getAllTemplates);
  const createTemplate = useMutation(api.templates.createTemplate);
  const updateTemplate = useMutation(api.templates.updateTemplate);
  const deleteTemplate = useMutation(api.templates.deleteTemplate);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<Id<"templates"> | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<Template | null>(
    null,
  );

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    pageName: "",
    templateType: "quiz" as TemplateType,
    background: { color: "#1e293b" } as PageBackground,
    components: [] as Component[],
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      pageName: "",
      templateType: "quiz",
      background: { color: "#1e293b" },
      components: [],
    });
    setEditingTemplate(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (template: Template) => {
    setEditingTemplate(template);
    setFormData({
      title: template.title,
      description: template.description || "",
      pageName: template.pageName || "",
      templateType: template.templateType,
      background: template.background || { color: "#1e293b" },
      components: template.components || [],
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast.error("Title is required");
      return;
    }

    setIsSaving(true);
    try {
      if (editingTemplate) {
        await updateTemplate({
          id: editingTemplate._id,
          title: formData.title,
          description: formData.description || undefined,
          pageName: formData.pageName || undefined,
          background: formData.background,
          components: formData.components,
          templateType: formData.templateType,
        });
        toast.success("Template updated successfully");
      } else {
        const result = await createTemplate({
          title: formData.title,
          description: formData.description || undefined,
          pageName: formData.pageName || undefined,
          background: formData.background,
          components: formData.components,
          templateType: formData.templateType,
        });
        if (!result.ok) {
          toast.error(result.message ?? "Failed to create template");
          return;
        }
        toast.success("Template created successfully");
      }
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error("Error saving template:", error);
      toast.error("Failed to save template");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (template: Template) => {
    setTemplateToDelete(template);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!templateToDelete) return;

    setDeletingId(templateToDelete._id);
    try {
      await deleteTemplate({ id: templateToDelete._id });
      toast.success("Template deleted successfully");
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
    } catch (error) {
      console.error("Error deleting template:", error);
      toast.error("Failed to delete template");
    } finally {
      setDeletingId(null);
    }
  };

  if (templates === undefined) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const templatesList = (templates ?? []) as Template[];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900">
              <LayoutTemplate className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                Template Management
              </h1>
              <p className="text-sm text-slate-500">
                Create and manage page templates
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleOpenCreate}
              className="bg-slate-900 text-white hover:bg-slate-800"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Template
            </Button>
            <ConvexUserButton />
          </div>
        </header>

        {/* Templates Grid */}
        {templatesList.length === 0 ? (
          <Card className="py-12">
            <CardContent className="flex flex-col items-center justify-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                <LayoutTemplate className="h-8 w-8 text-slate-400" />
              </div>
              <CardTitle className="mb-2">No templates yet</CardTitle>
              <CardDescription className="mb-6">
                Create your first template to get started.
              </CardDescription>
              <Button onClick={handleOpenCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Create Template
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templatesList.map((template) => (
              <Card key={template._id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{template.title}</CardTitle>
                      <CardDescription className="mt-1">
                        {template.description || "No description"}
                      </CardDescription>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.push(`/template/${template._id}`)}
                        className="h-8 w-8"
                        title="Edit template components"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(template)}
                        className="h-8 w-8"
                        title="Edit template metadata"
                      >
                        <LayoutTemplate className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteClick(template)}
                        className="h-8 w-8 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-600">Type:</span>
                      <span className="text-slate-500 capitalize">
                        {template.templateType}
                      </span>
                    </div>
                    {template.pageName && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-600">
                          Page Name:
                        </span>
                        <span className="text-slate-500">
                          {template.pageName}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-600">
                        Components:
                      </span>
                      <span className="text-slate-500">
                        {template.components.length}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Edit Template" : "Create Template"}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate
                ? "Update the template details below."
                : "Fill in the details to create a new template."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="Template title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Template description"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pageName">Page Name</Label>
              <Input
                id="pageName"
                value={formData.pageName}
                onChange={(e) =>
                  setFormData({ ...formData, pageName: e.target.value })
                }
                placeholder="Page name (optional)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="templateType">Template Type *</Label>
              <Select
                value={formData.templateType}
                onValueChange={(value: TemplateType) =>
                  setFormData({ ...formData, templateType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="quiz">Quiz Page</SelectItem>
                  <SelectItem value="result">Result Page</SelectItem>
                  <SelectItem value="onboarding">Onboarding Page</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="backgroundColor">Background Color</Label>
              <div className="flex gap-2">
                <Input
                  id="backgroundColor"
                  type="color"
                  value={formData.background?.color || "#1e293b"}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      background: { ...formData.background, color: e.target.value },
                    })
                  }
                  className="h-10 w-20"
                />
                <Input
                  value={formData.background?.color || "#1e293b"}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      background: { ...formData.background, color: e.target.value },
                    })
                  }
                  placeholder="#1e293b"
                />
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <AlertCircle className="h-4 w-4" />
                <span>
                  Component editing will be available in a future update. For
                  now, templates are created with empty components arrays.
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDialogOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold">
                &quot;{templateToDelete?.title}&quot;
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setTemplateToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleConfirmDelete()}
              disabled={!!deletingId}
            >
              {deletingId ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

