import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Pin, Trash2, Send } from 'lucide-react';
import { toast } from 'sonner';

interface Memo {
  id: string;
  content: string;
  author_name: string;
  is_pinned: boolean;
  created_at: string;
  created_by: string;
}

interface ResearchMemosSectionProps {
  language: string;
}

export function ResearchMemosSection({ language }: ResearchMemosSectionProps) {
  const { user } = useAuth();
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [newMemo, setNewMemo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchMemos();
    checkAdmin();
  }, [user]);

  async function checkAdmin() {
    if (!user) { setIsAdmin(false); return; }
    const { data } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();
    setIsAdmin(!!data);
  }

  async function fetchMemos() {
    const { data, error } = await supabase
      .from('research_memos')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (!error && data) setMemos(data as Memo[]);
    setLoading(false);
  }

  async function handlePost() {
    if (!newMemo.trim() || !user) return;
    setSubmitting(true);
    const { error } = await supabase.from('research_memos').insert({
      content: newMemo.trim(),
      author_name: 'Admin',
      created_by: user.id,
    });
    if (error) {
      toast.error(language === 'ko' ? '메모 등록 실패' : 'Failed to post memo');
    } else {
      toast.success(language === 'ko' ? '메모 등록 완료' : 'Memo posted');
      setNewMemo('');
      fetchMemos();
    }
    setSubmitting(false);
  }

  async function handleDelete(id: string) {
    if (!confirm(language === 'ko' ? '삭제하시겠습니까?' : 'Delete this memo?')) return;
    const { error } = await supabase.from('research_memos').delete().eq('id', id);
    if (!error) {
      toast.success(language === 'ko' ? '삭제 완료' : 'Deleted');
      fetchMemos();
    }
  }

  async function handleTogglePin(id: string, currentPin: boolean) {
    const { error } = await supabase
      .from('research_memos')
      .update({ is_pinned: !currentPin })
      .eq('id', id);
    if (!error) fetchMemos();
  }

  if (loading) {
    return (
      <div className="card-elevated p-6 mb-8 animate-fade-in">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h3 className="font-serif font-semibold">
            {language === 'ko' ? '리서치 메모' : 'Research Memos'}
          </h3>
        </div>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-muted rounded w-3/4" />
          <div className="h-4 bg-muted rounded w-1/2" />
        </div>
      </div>
    );
  }

  return (
    <div className="card-elevated overflow-hidden mb-8 animate-fade-in" style={{ animationDelay: '100ms' }}>
      <div className="p-4 border-b border-border flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-primary" />
        <h3 className="font-serif font-semibold text-sm">
          {language === 'ko' ? '리서치 메모' : 'Research Memos'}
        </h3>
        <span className="text-xs text-muted-foreground">({memos.length})</span>
      </div>

      {/* Admin: New memo form */}
      {isAdmin && (
        <div className="p-4 border-b border-border bg-muted/30">
          <Textarea
            value={newMemo}
            onChange={(e) => setNewMemo(e.target.value)}
            placeholder={language === 'ko' ? '메모를 작성하세요...' : 'Write a memo...'}
            className="mb-2 min-h-[80px] text-sm"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handlePost}
              disabled={submitting || !newMemo.trim()}
              className="btn-gold"
            >
              <Send className="h-3.5 w-3.5 mr-1" />
              {language === 'ko' ? '게시' : 'Post'}
            </Button>
          </div>
        </div>
      )}

      {/* Memos list */}
      <div className="divide-y divide-border">
        {memos.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            {language === 'ko' ? '등록된 메모가 없습니다' : 'No memos yet'}
          </div>
        ) : (
          memos.map((memo) => (
            <div key={memo.id} className={`p-4 ${memo.is_pinned ? 'bg-primary/5' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  {memo.is_pinned && (
                    <span className="inline-flex items-center gap-1 text-xs text-primary font-medium mb-1">
                      <Pin className="h-3 w-3" />
                      {language === 'ko' ? '고정' : 'Pinned'}
                    </span>
                  )}
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{memo.content}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {memo.author_name} · {new Date(memo.created_at).toLocaleString(
                      language === 'ko' ? 'ko-KR' : 'en-US',
                      { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
                    )}
                  </p>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleTogglePin(memo.id, memo.is_pinned)}
                      className="h-7 w-7 p-0"
                    >
                      <Pin className={`h-3.5 w-3.5 ${memo.is_pinned ? 'text-primary' : 'text-muted-foreground'}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(memo.id)}
                      className="h-7 w-7 p-0"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
