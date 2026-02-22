"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useCallback } from "react";
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Link as LinkIcon,
  Image as ImageIcon,
  Undo,
  Redo,
} from "lucide-react";

type Props = {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
};

export function TipTapEditor({ content, onChange, placeholder = "Skriv indhold her..." }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-secondary underline" } }),
      Image.configure({ HTMLAttributes: { class: "max-w-full rounded-lg my-4" } }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "min-h-[300px] prose prose-sm max-w-none focus:outline-none px-4 py-3",
      },
    },
  });

  // Sync content from outside (e.g. when editing an existing post)
  useEffect(() => {
    if (editor && content && editor.getHTML() !== content) {
      editor.commands.setContent(content);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  const addLink = useCallback(() => {
    if (!editor) return;
    const url = window.prompt("URL:");
    if (!url) return;
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  const addImage = useCallback(() => {
    if (!editor) return;
    const url = window.prompt("Billede URL:");
    if (!url) return;
    editor.chain().focus().setImage({ src: url }).run();
  }, [editor]);

  if (!editor) return null;

  const btn = (active: boolean) =>
    `p-1.5 rounded transition ${active ? "bg-secondary text-white" : "text-gray-600 hover:bg-gray-100"}`;

  return (
    <div className="border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-secondary">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-0.5 p-2 border-b bg-gray-50">
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btn(editor.isActive("bold"))} title="Fed"><Bold size={15} /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btn(editor.isActive("italic"))} title="Kursiv"><Italic size={15} /></button>

        <div className="w-px bg-gray-200 mx-1 self-stretch" />

        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={btn(editor.isActive("heading", { level: 2 }))} title="Overskrift 2"><Heading2 size={15} /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={btn(editor.isActive("heading", { level: 3 }))} title="Overskrift 3"><Heading3 size={15} /></button>

        <div className="w-px bg-gray-200 mx-1 self-stretch" />

        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btn(editor.isActive("bulletList"))} title="Punktliste"><List size={15} /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btn(editor.isActive("orderedList"))} title="Nummereret liste"><ListOrdered size={15} /></button>

        <div className="w-px bg-gray-200 mx-1 self-stretch" />

        <button type="button" onClick={addLink} className={btn(editor.isActive("link"))} title="Indsæt link"><LinkIcon size={15} /></button>
        <button type="button" onClick={addImage} className={btn(false)} title="Indsæt billede via URL"><ImageIcon size={15} /></button>

        <div className="w-px bg-gray-200 mx-1 self-stretch" />

        <button type="button" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} className={btn(false) + " disabled:opacity-30"} title="Fortryd"><Undo size={15} /></button>
        <button type="button" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} className={btn(false) + " disabled:opacity-30"} title="Gentag"><Redo size={15} /></button>
      </div>

      {/* Editor area */}
      <EditorContent editor={editor} />
    </div>
  );
}
