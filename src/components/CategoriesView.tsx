import React, { useState, useEffect } from 'react';
import { FolderTree, FolderOpen, Plus, Trash2, Check, Edit2 } from 'lucide-react';
import { CategoryItem } from '../types';
import { api } from '../services/api';

interface CategoriesViewProps {
  onOpenFolder: (path: string) => void;
  isDark: boolean;
}

export const CategoriesView: React.FC<CategoriesViewProps> = ({
  onOpenFolder,
  isDark,
}) => {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newExts, setNewExts] = useState('');
  const [newFolder, setNewFolder] = useState('');

  const fetchCategories = async () => {
    try {
      const list = await api.getCategories();
      setCategories(list);
    } catch (e) {
      console.warn('Error fetching categories:', e);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const exts = newExts.split(',').map(e => e.trim().replace('.', '').toLowerCase()).filter(Boolean);
    const cat: CategoryItem = {
      id: 'custom_' + Date.now(),
      name: newName.trim(),
      extensions: exts,
      destination_folder: newFolder.trim() || `Downloads/${newName.trim()}`,
      is_custom: true
    };

    await api.saveCategory(cat);
    setNewName('');
    setNewExts('');
    setNewFolder('');
    setIsAdding(false);
    fetchCategories();
  };

  const handleDelete = async (id: string) => {
    await api.deleteCategory(id);
    fetchCategories();
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-genesis-background p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-btn bg-genesis-primary/10 border border-genesis-primary/20 flex items-center justify-center text-genesis-primary">
            <FolderTree className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display font-bold text-lg text-genesis-text-primary">
              Download Categories & Smart Sorting
            </h1>
            <p className="text-xs text-genesis-text-secondary">
              Configure automatic folder organization rules based on file extensions.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsAdding(true)}
          className="px-3.5 py-2 text-xs font-medium text-white bg-genesis-primary hover:bg-genesis-primary-hover rounded-btn shadow-sm transition-all flex items-center gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New Category</span>
        </button>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-2 gap-4 overflow-y-auto flex-1">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className="p-4 rounded-card border border-genesis-border bg-white shadow-sm flex flex-col justify-between space-y-3"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="font-display font-bold text-sm text-genesis-text-primary">
                  {cat.name}
                </span>
                {cat.is_custom && (
                  <button
                    onClick={() => handleDelete(cat.id)}
                    className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                    title="Delete Custom Category"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="mt-2 space-y-1 text-xs">
                <span className="text-genesis-text-secondary text-[11px] block">Target Folder:</span>
                <span className="font-mono text-[11px] text-genesis-text-primary break-all block">
                  {cat.destination_folder}
                </span>
              </div>
            </div>

            <div>
              <span className="text-genesis-text-secondary text-[10px] uppercase font-bold tracking-wider block mb-1">
                Matched Extensions
              </span>
              <div className="flex flex-wrap gap-1">
                {cat.extensions.length === 0 ? (
                  <span className="text-[10px] text-genesis-text-secondary italic">All other extensions</span>
                ) : (
                  cat.extensions.map((ext) => (
                    <span
                      key={ext}
                      className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-genesis-background border border-genesis-border font-medium"
                    >
                      .{ext}
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-genesis-border flex justify-end">
              <button
                onClick={() => onOpenFolder(cat.destination_folder)}
                className="px-2.5 py-1 text-[11px] rounded border border-genesis-border hover:bg-genesis-muted flex items-center gap-1 text-genesis-text-secondary hover:text-genesis-text-primary transition-all"
              >
                <FolderOpen className="h-3 w-3" />
                <span>Open Folder</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Modal */}
      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <form onSubmit={handleCreate} className="w-full max-w-md bg-white rounded-card border border-genesis-border shadow-genesis-modal p-6 space-y-4">
            <h3 className="font-display font-bold text-base text-genesis-text-primary">Create Custom Category</h3>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-genesis-text-secondary">Category Name</label>
              <input
                required
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. 3D Models"
                className="w-full px-3 py-2 text-xs rounded border border-genesis-border outline-none focus:border-genesis-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-genesis-text-secondary">Extensions (Comma separated)</label>
              <input
                type="text"
                value={newExts}
                onChange={(e) => setNewExts(e.target.value)}
                placeholder="obj, fbx, blend, stl"
                className="w-full px-3 py-2 text-xs rounded border border-genesis-border outline-none focus:border-genesis-primary"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 text-xs rounded border border-genesis-border hover:bg-genesis-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium text-white bg-genesis-primary hover:bg-genesis-primary-hover rounded"
              >
                Save Category
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
