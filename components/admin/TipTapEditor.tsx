"use client";

import { useEditor, useEditorState, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useCallback, type MouseEvent } from "react";
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
    immediatelyRender: false,
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
          "min-h-[300px] max-w-none focus:outline-none px-4 py-3 [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:list-outside [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:list-outside [&_ol]:pl-6 [&_li]:my-1",
      },
    },
  });

  const toolbarState = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor?.isActive("bold") ?? false,
      italic: editor?.isActive("italic") ?? false,
      heading2: editor?.isActive("heading", { level: 2 }) ?? false,
      heading3: editor?.isActive("heading", { level: 3 }) ?? false,
      bulletList: editor?.isActive("bulletList") ?? false,
      orderedList: editor?.isActive("orderedList") ?? false,
      link: editor?.isActive("link") ?? false,
      canUndo: editor?.can().chain().focus().undo().run() ?? false,
      canRedo: editor?.can().chain().focus().redo().run() ?? false,
    }),
  });

  // Sync content from outside (e.g. when loaded async from DB after editor mounts)
  useEffect(() => {
    if (editor && content !== undefined && editor.getHTML() !== content) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [editor, content]);

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

  const runToolbarCommand = useCallback((event: MouseEvent<HTMLButtonElement>, command: () => void) => {
    event.preventDefault();
    command();
  }, []);

  if (!editor || !toolbarState) return null;

  const btn = (active: boolean) =>
    `p-1.5 rounded transition ${active ? "bg-secondary text-white" : "text-gray-600 hover:bg-gray-100"}`;

  return (
    <div className="border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-secondary">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-0.5 p-2 border-b bg-gray-50" onMouseDown={(e) => e.preventDefault()}>
        <button
          type="button"
          onMouseDown={(event) => runToolbarCommand(event, () => { editor.chain().focus().toggleBold().run(); })}
          className={btn(toolbarState.bold)}
          title="Fed"
        >
          <Bold size={15} />
        </button>
        <button
          type="button"
          onMouseDown={(event) => runToolbarCommand(event, () => { editor.chain().focus().toggleItalic().run(); })}
          className={btn(toolbarState.italic)}
          title="Kursiv"
        >
          <Italic size={15} />
        </button>

        <div className="w-px bg-gray-200 mx-1 self-stretch" />

        <button
          type="button"
          onMouseDown={(event) => runToolbarCommand(event, () => { editor.chain().focus().toggleHeading({ level: 2 }).run(); })}
          className={btn(toolbarState.heading2)}
          title="Overskrift 2"
        >
          <Heading2 size={15} />
        </button>
        <button
          type="button"
          onMouseDown={(event) => runToolbarCommand(event, () => { editor.chain().focus().toggleHeading({ level: 3 }).run(); })}
          className={btn(toolbarState.heading3)}
          title="Overskrift 3"
        >
          <Heading3 size={15} />
        </button>

        <div className="w-px bg-gray-200 mx-1 self-stretch" />

        <button
          type="button"
          onMouseDown={(event) => runToolbarCommand(event, () => { editor.chain().focus().toggleBulletList().run(); })}
          className={btn(toolbarState.bulletList)}
          title="Punktliste"
        >
          <List size={15} />
        </button>
        <button
          type="button"
          onMouseDown={(event) => runToolbarCommand(event, () => { editor.chain().focus().toggleOrderedList().run(); })}
          className={btn(toolbarState.orderedList)}
          title="Nummereret liste"
        >
          <ListOrdered size={15} />
        </button>

        <div className="w-px bg-gray-200 mx-1 self-stretch" />

        <button
          type="button"
          onMouseDown={(event) => runToolbarCommand(event, addLink)}
          className={btn(toolbarState.link)}
          title="Indsæt link"
        >
          <LinkIcon size={15} />
        </button>
        <button
          type="button"
          onMouseDown={(event) => runToolbarCommand(event, addImage)}
          className={btn(false)}
          title="Indsæt billede via URL"
        >
          <ImageIcon size={15} />
        </button>

        <div className="w-px bg-gray-200 mx-1 self-stretch" />

        <button
          type="button"
          onMouseDown={(event) => runToolbarCommand(event, () => { editor.chain().focus().undo().run(); })}
          disabled={!toolbarState.canUndo}
          className={btn(false) + " disabled:opacity-30"}
          title="Fortryd"
        >
          <Undo size={15} />
        </button>
        <button
          type="button"
          onMouseDown={(event) => runToolbarCommand(event, () => { editor.chain().focus().redo().run(); })}
          disabled={!toolbarState.canRedo}
          className={btn(false) + " disabled:opacity-30"}
          title="Gentag"
        >
          <Redo size={15} />
        </button>
      </div>

      {/* Editor area */}
      <EditorContent editor={editor} />
    </div>
  );
}
