import { useState } from 'react';
import { X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { groupsApi } from '../api/groups';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const EMOJIS = ['💰', '🏠', '✈️', '🍕', '🎉', '🚗', '🏖️', '🎮', '🏋️', '🛒', '💼', '🎓'];
const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#14b8a6'];

interface Props {
  onClose: () => void;
}

export default function CreateGroupModal({ onClose }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [emoji, setEmoji] = useState('💰');
  const [color, setColor] = useState('#6366f1');
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: () => groupsApi.create({ name, description, emoji, color }),
    onSuccess: (group) => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      toast.success(`Group "${group.name}" created!`);
      navigate(`/groups/${group.id}`);
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to create group');
    },
  });

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content max-w-md w-full">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create Group</h2>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <form
          className="p-5 space-y-4"
          onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
        >
          {/* Emoji picker */}
          <div>
            <label className="label">Group Icon</label>
            <div className="flex flex-wrap gap-2">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={`w-10 h-10 text-xl rounded-lg flex items-center justify-center transition-all ${
                    emoji === e ? 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Color picker */}
          <div>
            <label className="label">Color</label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-offset-gray-900 scale-110' : 'hover:scale-105'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="label">Group Name *</label>
            <input
              className="input"
              placeholder="e.g. Trip to Paris"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="What's this group for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={!name.trim() || mutation.isPending}>
              {mutation.isPending ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
