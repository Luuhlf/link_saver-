"use client";

import { useState, useEffect } from "react";
import { useAuth } from "./firebase-provider";
import { db, handleFirestoreError, OperationType } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
} from "firebase/firestore";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Label } from "./ui/label";
import { LogOut, Archive, ArchiveRestore, Trash2, ExternalLink, Plus, Search, Tag, BookOpen, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";

interface LinkItem {
  id: string;
  url: string;
  title: string;
  tags: string[];
  archived: boolean;
  userId: string;
  createdAt: Timestamp;
}

const TAG_COLORS = [
  "bg-red-500/10 text-red-400 border-red-500/20",
  "bg-orange-500/10 text-orange-400 border-orange-500/20",
  "bg-amber-500/10 text-amber-400 border-amber-500/20",
  "bg-green-500/10 text-green-400 border-green-500/20",
  "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "bg-teal-500/10 text-teal-400 border-teal-500/20",
  "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  "bg-violet-500/10 text-violet-400 border-violet-500/20",
  "bg-purple-500/10 text-purple-400 border-purple-500/20",
  "bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20",
  "bg-pink-500/10 text-pink-400 border-pink-500/20",
  "bg-rose-500/10 text-rose-400 border-rose-500/20",
];

const getTagColor = (tag: string) => {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
};

export function MainApp() {
  const { user, loading, signIn, signOut } = useAuth();
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  
  // Form state
  const [newUrl, setNewUrl] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newTags, setNewTags] = useState("");

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [viewArchived, setViewArchived] = useState(false);

  // Reader state
  const [readerOpen, setReaderOpen] = useState(false);
  const [readerLoading, setReaderLoading] = useState(false);
  const [readerContent, setReaderContent] = useState<{title: string, content: string} | null>(null);
  const [readerError, setReaderError] = useState("");

  useEffect(() => {
    if (!user) {
      return;
    }

    const q = query(
      collection(db, "links"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedLinks = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as LinkItem[];
        setLinks(fetchedLinks);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "links");
      }
    );

    return () => unsubscribe();
  }, [user]);

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newUrl) return;

    const tagsArray = newTags
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0)
      .slice(0, 20);

    try {
      await addDoc(collection(db, "links"), {
        url: newUrl,
        title: newTitle || newUrl,
        tags: tagsArray,
        archived: false,
        userId: user.uid,
        createdAt: Timestamp.now(),
      });
      setNewUrl("");
      setNewTitle("");
      setNewTags("");
      setIsAdding(false);
    } catch (error) {
      console.error("Error adding link:", error);
      // Even if there's an error (like permissions), close the dialog so it doesn't hang
      setIsAdding(false);
      try {
        handleFirestoreError(error, OperationType.CREATE, "links");
      } catch (e) {
        // Ignore the thrown error from handleFirestoreError so it doesn't crash the handler
      }
    }
  };

  const handleToggleArchive = async (link: LinkItem) => {
    try {
      await updateDoc(doc(db, "links", link.id), {
        archived: !link.archived,
        userId: link.userId,
        createdAt: link.createdAt,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `links/${link.id}`);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "links", id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `links/${id}`);
    }
  };

  const openReader = async (url: string) => {
    setReaderOpen(true);
    setReaderLoading(true);
    setReaderError("");
    setReaderContent(null);

    try {
      const res = await fetch(`/api/read?url=${encodeURIComponent(url)}`);
      
      if (!res.ok) {
        let errorMessage = "Failed to load content";
        try {
          const errorData = await res.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          errorMessage = `Server error (${res.status}). The server might be overloaded or the URL is invalid.`;
        }
        throw new Error(errorMessage);
      }

      const data = await res.json();

      setReaderContent({
        title: data.title,
        content: data.content,
      });
    } catch (err: any) {
      setReaderError(err.message || "Could not extract article content.");
    } finally {
      setReaderLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 p-4">
        <Card className="w-full max-w-md text-center border-zinc-800 bg-zinc-900/50">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-zinc-100">Link Saver</CardTitle>
            <CardDescription className="text-zinc-400">Save, organize, and read your links later.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={signIn} className="w-full" size="lg">
              Sign in with Google
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const allTags = Array.from(new Set(links.flatMap((link) => link.tags))).sort();

  const filteredLinks = links.filter((link) => {
    const matchesArchive = link.archived === viewArchived;
    const matchesSearch =
      link.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      link.url.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag = selectedTag ? link.tags.includes(selectedTag) : true;
    return matchesArchive && matchesSearch && matchesTag;
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <header className="sticky top-0 z-10 border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-md px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-zinc-100 border border-zinc-700">
              <ExternalLink className="h-4 w-4" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Link Saver</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-zinc-400 sm:inline-block">
              {user.email}
            </span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-4 py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <Input
                placeholder="Search links..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Dialog open={isAdding} onOpenChange={setIsAdding}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Link
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Save a new link</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddLink} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="url">URL *</Label>
                    <Input
                      id="url"
                      type="url"
                      placeholder="https://example.com"
                      value={newUrl}
                      onChange={(e) => setNewUrl(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="title">Title (Optional)</Label>
                    <Input
                      id="title"
                      placeholder="My awesome link"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tags">Tags (comma separated)</Label>
                    <Input
                      id="tags"
                      placeholder="tech, reading, news"
                      value={newTags}
                      onChange={(e) => setNewTags(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    Save Link
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-[200px_1fr] lg:grid-cols-[250px_1fr]">
          {/* Sidebar */}
          <aside className="space-y-6">
            <div className="space-y-1">
              <Button
                variant={!viewArchived ? "secondary" : "ghost"}
                className="w-full justify-start"
                onClick={() => setViewArchived(false)}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Inbox
                {!viewArchived && (
                  <span className="ml-auto rounded-full bg-zinc-950 border border-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-300">
                    {links.filter((l) => !l.archived).length}
                  </span>
                )}
              </Button>
              <Button
                variant={viewArchived ? "secondary" : "ghost"}
                className="w-full justify-start"
                onClick={() => setViewArchived(true)}
              >
                <Archive className="mr-2 h-4 w-4" />
                Archived
                {viewArchived && (
                  <span className="ml-auto rounded-full bg-zinc-950 border border-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-300">
                    {links.filter((l) => l.archived).length}
                  </span>
                )}
              </Button>
            </div>

            {allTags.length > 0 && (
              <div>
                <h3 className="mb-3 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Tags
                </h3>
                <div className="space-y-1">
                  <Button
                    variant={selectedTag === null ? "secondary" : "ghost"}
                    className="w-full justify-start text-sm"
                    onClick={() => setSelectedTag(null)}
                  >
                    All Tags
                  </Button>
                  {allTags.map((tag) => (
                    <Button
                      key={tag}
                      variant={selectedTag === tag ? "secondary" : "ghost"}
                      className="w-full justify-start text-sm"
                      onClick={() => setSelectedTag(tag)}
                    >
                      <Tag className="mr-2 h-3 w-3" />
                      {tag}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </aside>

          {/* Main Content */}
          <div className="space-y-4">
            {filteredLinks.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 py-16 text-center">
                <div className="mb-4 rounded-full bg-zinc-900 border border-zinc-800 p-4">
                  <ExternalLink className="h-6 w-6 text-zinc-500" />
                </div>
                <h3 className="mb-1 text-lg font-medium text-zinc-200">No links found</h3>
                <p className="text-sm text-zinc-500">
                  {searchQuery || selectedTag
                    ? "Try adjusting your search or filters."
                    : viewArchived
                    ? "You haven't archived any links yet."
                    : "Save your first link to get started."}
                </p>
              </div>
            ) : (
              filteredLinks.map((link) => (
                <Card key={link.id} className="overflow-hidden transition-all hover:border-zinc-700 bg-zinc-900/40">
                  <CardContent className="p-0">
                    <div className="flex flex-col sm:flex-row">
                      <div className="flex-1 p-5">
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group mb-1 inline-flex items-start gap-2 text-lg font-semibold text-zinc-100 hover:text-zinc-300"
                        >
                          {link.title}
                          <ExternalLink className="mt-1 h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100 text-zinc-500" />
                        </a>
                        <p className="mb-4 truncate text-sm text-zinc-500">{link.url}</p>
                        {link.tags.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {link.tags.map((tag) => (
                              <Badge key={tag} variant="outline" className={getTagColor(tag)}>
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-end gap-2 border-t border-zinc-800/50 bg-zinc-900/50 px-5 py-3 sm:border-l sm:border-t-0 sm:flex-col sm:justify-center sm:py-5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openReader(link.url)}
                          title="Reader Mode"
                          className="h-9 w-9 p-0 hover:bg-zinc-800 hover:text-zinc-100"
                        >
                          <BookOpen className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleArchive(link)}
                          title={link.archived ? "Unarchive" : "Archive"}
                          className="h-9 w-9 p-0 hover:bg-zinc-800 hover:text-zinc-100"
                        >
                          {link.archived ? (
                            <ArchiveRestore className="h-4 w-4 text-zinc-400" />
                          ) : (
                            <Archive className="h-4 w-4 text-zinc-400" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(link.id)}
                          title="Delete"
                          className="h-9 w-9 p-0 hover:bg-red-900/30 hover:text-red-400 text-zinc-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </main>

      {/* Reader Mode Dialog */}
      <Dialog open={readerOpen} onOpenChange={setReaderOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {readerLoading ? "Loading Article..." : readerContent?.title || "Reader Mode"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="mt-4">
            {readerLoading && (
              <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                <Loader2 className="h-8 w-8 animate-spin mb-4" />
                <p>Extracting content...</p>
              </div>
            )}

            {readerError && (
              <div className="rounded-lg border border-red-900/50 bg-red-900/10 p-4 text-red-400">
                <p>{readerError}</p>
                <p className="mt-2 text-sm">Some websites block automated extraction. You may need to visit the original link.</p>
              </div>
            )}

            {readerContent && !readerLoading && !readerError && (
              <article 
                className="prose prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: readerContent.content }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
