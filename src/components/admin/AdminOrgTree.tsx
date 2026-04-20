import { useState, useEffect, useCallback, useRef, DragEvent } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, Building2, UserCog, Users, User, RefreshCw, GripVertical, ArrowRight, Trash2, TrendingUp, Coins } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { MemberLink } from '@/components/MemberLink';

// Count all descendants in the subtree
function countDescendants(node: TreeNode): number {
  let count = node.children.length;
  for (const child of node.children) count += countDescendants(child);
  return count;
}

// Aggregate investment count and total amount across the node + entire subtree
function aggregateSubtreeInvestments(
  node: TreeNode,
  invMap: Map<string, { count: number; totalUSD: number }>
): { count: number; totalUSD: number } {
  const own = invMap.get(node.user_id) || { count: 0, totalUSD: 0 };
  let count = own.count;
  let totalUSD = own.totalUSD;
  for (const child of node.children) {
    const sub = aggregateSubtreeInvestments(child, invMap);
    count += sub.count;
    totalUSD += sub.totalUSD;
  }
  return { count, totalUSD };
}

function formatCompactUSD(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
  return `$${Math.round(amount)}`;
}

interface TreeNode {
  user_id: string;
  full_name: string;
  full_name_ko: string | null;
  email: string;
  sales_role: string | null;
  sales_level: number | null;
  sales_status: string | null;
  parent_id: string | null;
  children: TreeNode[];
}

const ROLE_LEVELS: Record<string, number> = {
  webmaster: 0,
  district_manager: 1,
  deputy_district_manager: 2,
  principal_agent: 3,
  agent: 4,
  client: 5,
};

const ROLE_LABELS: Record<string, { en: string; ko: string }> = {
  webmaster: { en: 'Webmaster', ko: '웹마스터' },
  district_manager: { en: 'General Manager', ko: '총괄관리' },
  deputy_district_manager: { en: 'Deputy General Manager', ko: '부총괄관리' },
  principal_agent: { en: 'Principal Agent', ko: '수석 에이전트' },
  agent: { en: 'Agent', ko: '에이전트' },
  client: { en: 'Client', ko: '고객' },
};

const ROLE_ICONS: Record<string, typeof Building2> = {
  webmaster: Building2,
  district_manager: Building2,
  deputy_district_manager: Building2,
  principal_agent: UserCog,
  agent: Users,
  client: User,
};

const ROLE_COLORS: Record<string, string> = {
  webmaster: 'bg-primary text-primary-foreground',
  district_manager: 'bg-primary text-primary-foreground',
  deputy_district_manager: 'bg-primary/80 text-primary-foreground',
  principal_agent: 'bg-secondary text-secondary-foreground',
  agent: 'border border-border bg-background text-foreground',
  client: 'border border-border bg-muted text-muted-foreground',
};

const STATUS_DOT: Record<string, string> = {
  active: 'bg-green-500',
  pending: 'bg-amber-500',
  suspended: 'bg-red-500',
  rejected: 'bg-muted-foreground',
};

// Check if nodeId is a descendant of ancestorId in the tree
function isDescendant(tree: TreeNode[], ancestorId: string, nodeId: string): boolean {
  const find = (nodes: TreeNode[]): boolean => {
    for (const n of nodes) {
      if (n.user_id === ancestorId) {
        return findInChildren(n.children, nodeId);
      }
      if (find(n.children)) return true;
    }
    return false;
  };
  const findInChildren = (nodes: TreeNode[], targetId: string): boolean => {
    for (const n of nodes) {
      if (n.user_id === targetId) return true;
      if (findInChildren(n.children, targetId)) return true;
    }
    return false;
  };
  return find(tree);
}

interface TreeNodeComponentProps {
  node: TreeNode;
  language: string;
  depth?: number;
  draggedNode: TreeNode | null;
  dropTargetId: string | null;
  tree: TreeNode[];
  invMap: Map<string, { count: number; totalUSD: number }>;
  onDragStart: (node: TreeNode) => void;
  onDragEnd: () => void;
  onDropTarget: (targetId: string | null) => void;
  onDrop: (targetNode: TreeNode) => void;
  onDelete: (node: TreeNode) => void;
}

function TreeNodeComponent({
  node, language, depth = 0, draggedNode, dropTargetId, tree, invMap,
  onDragStart, onDragEnd, onDropTarget, onDrop, onDelete,
}: TreeNodeComponentProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const role = node.sales_role || 'client';
  const Icon = ROLE_ICONS[role] || User;
  const roleLabel = ROLE_LABELS[role];
  const displayName = language === 'ko' && node.full_name_ko ? node.full_name_ko : node.full_name;

  const isDragging = draggedNode?.user_id === node.user_id;
  const isDropTarget = dropTargetId === node.user_id;

  // Can this node accept the dragged node?
  const canAcceptDrop = (() => {
    if (!draggedNode) return false;
    if (draggedNode.user_id === node.user_id) return false;
    // Can't drop onto own descendant (cycle)
    if (isDescendant(tree, draggedNode.user_id, node.user_id)) return false;
    // Can't drop onto current parent (no change)
    if (draggedNode.parent_id === node.user_id) return false;
    // Target must have a higher rank (lower number) than dragged node
    // Exception: webmaster can sponsor another webmaster
    const targetLevel = ROLE_LEVELS[node.sales_role || ''] || 5;
    const draggedLevel = ROLE_LEVELS[draggedNode.sales_role || ''] || 5;
    const bothWebmaster = node.sales_role === 'webmaster' && draggedNode.sales_role === 'webmaster';
    if (targetLevel >= draggedLevel && !bothWebmaster) return false;
    // Target can't be a client (clients can't sponsor)
    if (node.sales_role === 'client') return false;
    return true;
  })();

  const handleDragStart = (e: DragEvent) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', node.user_id);
    onDragStart(node);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (canAcceptDrop) {
      e.dataTransfer.dropEffect = 'move';
      onDropTarget(node.user_id);
    } else {
      e.dataTransfer.dropEffect = 'none';
    }
  };

  const handleDragLeave = (e: DragEvent) => {
    e.stopPropagation();
    if (dropTargetId === node.user_id) {
      onDropTarget(null);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (canAcceptDrop) {
      onDrop(node);
    }
    onDropTarget(null);
  };

  return (
    <div>
      <div
        draggable
        onDragStart={handleDragStart}
        onDragEnd={onDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          flex items-center gap-1 sm:gap-2 group rounded-lg px-1.5 sm:px-3 py-1.5 sm:py-2.5 transition-all text-[10px] sm:text-sm
          ${isDragging ? 'opacity-40 scale-[0.97]' : ''}
          ${isDropTarget && canAcceptDrop
            ? 'bg-primary/10 ring-2 ring-primary/50 ring-inset shadow-sm'
            : 'hover:bg-accent/50'
          }
          ${draggedNode && !isDragging && !canAcceptDrop ? 'opacity-60' : ''}
          cursor-grab active:cursor-grabbing
        `}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {/* Drag handle */}
        <GripVertical className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground flex-shrink-0" />

        {/* Expand/Collapse */}
        <div
          className="w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center flex-shrink-0 cursor-pointer"
          onClick={(e) => { e.stopPropagation(); hasChildren && setExpanded(!expanded); }}
        >
          {hasChildren ? (
            expanded ? (
              <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            )
          ) : (
            <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
          )}
        </div>

        {/* Icon */}
        <div className={`rounded-full p-1 sm:p-1.5 flex-shrink-0 ${ROLE_COLORS[role]}`}>
          <Icon className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5" />
        </div>

        {/* Name & Info */}
        <div className="flex items-center gap-1 sm:gap-1.5 flex-1 min-w-0">
          <MemberLink userId={node.user_id} className="font-medium text-[10px] sm:text-sm truncate">
            {displayName}
          </MemberLink>
          <Badge variant="outline" className="text-[8px] sm:text-[10px] px-1 sm:px-1.5 py-0 h-4 sm:h-5 flex-shrink-0 hidden sm:inline-flex">
            {language === 'ko' ? roleLabel?.ko : roleLabel?.en}
          </Badge>
          {/* Subtree count for managers (DM/Deputy DM/Principal Agent) */}
          {hasChildren && (role === 'district_manager' || role === 'deputy_district_manager' || role === 'principal_agent') && (
            <Badge
              variant="secondary"
              className="text-[8px] sm:text-[10px] px-1 sm:px-1.5 py-0 h-4 sm:h-5 flex-shrink-0 gap-0.5"
              title={language === 'ko' ? '하부 멤버 수 (전체)' : 'Total downline members'}
            >
              <Users className="h-2 w-2 sm:h-2.5 sm:w-2.5" />
              {countDescendants(node)}
            </Badge>
          )}
          {node.sales_status && (
            <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full flex-shrink-0 ${STATUS_DOT[node.sales_status] || 'bg-muted-foreground'}`} title={node.sales_status} />
          )}
          {/* Email — placed inline next to name with reduced gap */}
          {!isDropTarget && (
            <span className="text-[9px] sm:text-xs text-muted-foreground hidden md:inline truncate ml-1">
              {node.email}
            </span>
          )}
        </div>

        {/* Drop indicator */}
        {isDropTarget && canAcceptDrop && (
          <span className="text-[9px] sm:text-xs text-primary font-medium flex items-center gap-1 flex-shrink-0">
            <ArrowRight className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
            {language === 'ko' ? '여기로 이동' : 'Drop here'}
          </span>
        )}

        {/* Direct children count */}
        {hasChildren && (
          <Badge variant="outline" className="text-[8px] sm:text-[10px] px-1 sm:px-1.5 py-0 h-4 sm:h-5 flex-shrink-0">
            {node.children.length}
          </Badge>
        )}

        {/* Delete button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 sm:h-7 sm:w-7 flex-shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => { e.stopPropagation(); onDelete(node); }}
          title={language === 'ko' ? '삭제' : 'Delete'}
        >
          <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
        </Button>
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div className="relative">
          <div
            className="absolute top-0 bottom-0 border-l border-border"
            style={{ left: `${depth * 16 + 16}px` }}
          />
          {node.children.map((child) => (
            <TreeNodeComponent
              key={child.user_id}
              node={child}
              language={language}
              depth={depth + 1}
              draggedNode={draggedNode}
              dropTargetId={dropTargetId}
              tree={tree}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDropTarget={onDropTarget}
              onDrop={onDrop}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminOrgTree() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [reassigning, setReassigning] = useState(false);
  const [stats, setStats] = useState({ total: 0, roles: {} as Record<string, number> });

  // Drag state
  const [draggedNode, setDraggedNode] = useState<TreeNode | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  // Confirmation dialog
  const [confirmMove, setConfirmMove] = useState<{
    open: boolean;
    source: TreeNode | null;
    target: TreeNode | null;
  }>({ open: false, source: null, target: null });

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; node: TreeNode | null }>({ open: false, node: null });
  const [deleting, setDeleting] = useState(false);
  const [promoteChildren, setPromoteChildren] = useState(false);

  // Per-user investment aggregates (count + total normalized to USD for subtree comparability)
  const [invMap, setInvMap] = useState<Map<string, { count: number; totalUSD: number }>>(new Map());

  const buildTree = useCallback((profiles: any[]): TreeNode[] => {
    const nodeMap = new Map<string, TreeNode>();
    profiles.forEach((p) => {
      nodeMap.set(p.user_id, {
        user_id: p.user_id,
        full_name: p.full_name,
        full_name_ko: p.full_name_ko,
        email: p.email,
        sales_role: p.sales_role,
        sales_level: p.sales_level,
        sales_status: p.sales_status,
        parent_id: p.parent_id,
        children: [],
      });
    });

    const roots: TreeNode[] = [];
    nodeMap.forEach((node) => {
      if (node.parent_id && nodeMap.has(node.parent_id)) {
        nodeMap.get(node.parent_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    });

    const ROLE_ORDER: Record<string, number> = { district_manager: 1, deputy_district_manager: 2, principal_agent: 3, agent: 4, client: 5 };
    const sortChildren = (nodes: TreeNode[]) => {
      nodes.sort((a, b) => {
        const aO = ROLE_ORDER[a.sales_role || 'client'] || 5;
        const bO = ROLE_ORDER[b.sales_role || 'client'] || 5;
        return aO !== bO ? aO - bO : a.full_name.localeCompare(b.full_name);
      });
      nodes.forEach((n) => sortChildren(n.children));
    };
    sortChildren(roots);
    return roots;
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('user_id, full_name, full_name_ko, email, sales_role, sales_level, sales_status, parent_id')
      .eq('is_approved', true)
      .or('is_rejected.is.null,is_rejected.eq.false')
      .or('is_deleted.is.null,is_deleted.eq.false')
      .order('sales_level', { ascending: true });

    const profiles = data || [];
    setTree(buildTree(profiles));

    const roleCounts: Record<string, number> = {};
    profiles.forEach((p) => { roleCounts[p.sales_role || 'unknown'] = (roleCounts[p.sales_role || 'unknown'] || 0) + 1; });
    setStats({ total: profiles.length, roles: roleCounts });
    setLoading(false);
  }, [buildTree]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDragStart = (node: TreeNode) => setDraggedNode(node);
  const handleDragEnd = () => { setDraggedNode(null); setDropTargetId(null); };
  const handleDropTarget = (id: string | null) => setDropTargetId(id);

  const handleDrop = (targetNode: TreeNode) => {
    if (!draggedNode) return;
    setConfirmMove({ open: true, source: draggedNode, target: targetNode });
    setDraggedNode(null);
    setDropTargetId(null);
  };

  const handleDelete = (node: TreeNode) => {
    setPromoteChildren(false);
    setConfirmDelete({ open: true, node });
  };

  const executeDelete = async () => {
    const node = confirmDelete.node;
    if (!node) return;
    setDeleting(true);
    try {
      // If requested and node has children, promote them to its parent (grandparent) first.
      // If node has no parent (root), promotion is not possible — children stay in place.
      if (promoteChildren && node.children.length > 0 && node.parent_id) {
        const childIds = node.children.map((c) => c.user_id);
        const { error: promoteErr } = await supabase
          .from('profiles')
          .update({ parent_id: node.parent_id })
          .in('user_id', childIds);

        if (promoteErr) {
          toast.error(language === 'ko'
            ? `하위 멤버 승격 실패: ${promoteErr.message}`
            : `Failed to promote downline: ${promoteErr.message}`);
          setDeleting(false);
          return;
        }

        // Recalculate commissions for each promoted child's investments
        for (const childId of childIds) {
          const { data: invs } = await supabase
            .from('client_investments')
            .select('id')
            .eq('user_id', childId);
          if (invs) {
            for (const inv of invs) {
              try {
                await supabase.functions.invoke('calculate-commissions', {
                  body: { investment_id: inv.id },
                });
              } catch (e) {
                console.error('Commission recalc failed for', inv.id, e);
              }
            }
          }
        }
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          deleted_by: user?.id ?? null,
          sales_status: 'suspended',
        })
        .eq('user_id', node.user_id);

      if (error) {
        toast.error(language === 'ko' ? `삭제 실패: ${error.message}` : `Delete failed: ${error.message}`);
      } else {
        toast.success(
          promoteChildren && node.children.length > 0 && node.parent_id
            ? (language === 'ko'
                ? `멤버가 삭제되고 하위 ${node.children.length}명이 상위 스폰서로 승격되었습니다.`
                : `Member deleted and ${node.children.length} downline member(s) promoted to parent sponsor.`)
            : (language === 'ko' ? '멤버가 삭제되었습니다.' : 'Member deleted.')
        );
        fetchData();
      }
    } catch (err: any) {
      toast.error(language === 'ko' ? '삭제 중 오류가 발생했습니다.' : 'Error during deletion.');
    } finally {
      setDeleting(false);
      setConfirmDelete({ open: false, node: null });
    }
  };

  const executeReassignment = async () => {
    const { source, target } = confirmMove;
    if (!source || !target) return;

    setReassigning(true);
    try {
      // Update parent_id to new sponsor's user_id
      const { error } = await supabase
        .from('profiles')
        .update({ parent_id: target.user_id })
        .eq('user_id', source.user_id);

      if (error) {
        // The DB trigger validate_hierarchy_depth will catch invalid moves
        const msg = error.message || '';
        if (msg.includes('cannot sponsor')) {
          toast.error(language === 'ko'
            ? '역할 계층 위반: 스폰서의 역할이 하위 멤버보다 높아야 합니다.'
            : 'Hierarchy violation: sponsor role must be above the member.');
        } else if (msg.includes('cycle')) {
          toast.error(language === 'ko' ? '순환 참조가 감지되었습니다.' : 'Cycle detected in hierarchy.');
        } else if (msg.includes('depth')) {
          toast.error(language === 'ko' ? '최대 5단계 깊이를 초과합니다.' : 'Maximum hierarchy depth of 5 exceeded.');
        } else {
          toast.error(language === 'ko' ? `재배치 실패: ${msg}` : `Reassignment failed: ${msg}`);
        }
        console.error(error);
      } else {
        const sourceName = language === 'ko' && source.full_name_ko ? source.full_name_ko : source.full_name;
        const targetName = language === 'ko' && target.full_name_ko ? target.full_name_ko : target.full_name;

        toast.success(
          language === 'ko'
            ? `${sourceName}이(가) ${targetName} 하위로 이동되었습니다.`
            : `${sourceName} has been moved under ${targetName}.`
        );

        // Recalculate commissions for affected investments
        const { data: investments } = await supabase
          .from('client_investments')
          .select('id')
          .eq('user_id', source.user_id);

        if (investments && investments.length > 0) {
          for (const inv of investments) {
            try {
              await supabase.functions.invoke('calculate-commissions', {
                body: { investment_id: inv.id },
              });
            } catch (e) {
              console.error('Commission recalc failed for', inv.id, e);
            }
          }
        }

        fetchData();
      }
    } catch (err) {
      console.error(err);
      toast.error(language === 'ko' ? '재배치 중 오류가 발생했습니다.' : 'Error during reassignment.');
    } finally {
      setReassigning(false);
      setConfirmMove({ open: false, source: null, target: null });
    }
  };

  const getDisplayName = (node: TreeNode | null) => {
    if (!node) return '';
    return language === 'ko' && node.full_name_ko ? node.full_name_ko : node.full_name;
  };

  const getRoleLabel = (role: string | null) => {
    if (!role) return '';
    const l = ROLE_LABELS[role];
    return language === 'ko' ? l?.ko : l?.en;
  };

  return (
    <div className="card-elevated">
      {/* Header */}
      <div className="p-3 sm:p-6 border-b border-border">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-base sm:text-xl font-serif font-semibold truncate">
              {language === 'ko' ? '영업 조직도' : 'Sales Organization Tree'}
            </h2>
            <p className="text-[10px] sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
              {language === 'ko'
                ? `총 ${stats.total}명 · 드래그하여 스폰서를 변경할 수 있습니다`
                : `${stats.total} users · Drag members to reassign sponsors`}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="text-[10px] sm:text-sm px-2 sm:px-3 h-7 sm:h-9 shrink-0">
            <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{language === 'ko' ? '새로고침' : 'Refresh'}</span>
          </Button>
        </div>

        {!loading && stats.total > 0 && (
          <div className="flex gap-2 sm:gap-3 mt-2 sm:mt-4 flex-wrap">
            {Object.entries(ROLE_LABELS).map(([key, labels]) => {
              const count = stats.roles[key] || 0;
              if (count === 0) return null;
              const RIcon = ROLE_ICONS[key] || User;
              return (
                <div key={key} className="flex items-center gap-1 text-[10px] sm:text-sm text-muted-foreground">
                  <RIcon className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5" />
                  <span className="hidden sm:inline">{language === 'ko' ? labels.ko : labels.en}</span>
                  <Badge variant="secondary" className="text-[8px] sm:text-[10px] px-1 sm:px-1.5 py-0 h-4 sm:h-5">{count}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tree */}
      <div className="p-4">
        {loading ? (
          <div className="space-y-3 p-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" style={{ marginLeft: `${(i % 3) * 28}px` }} />
            ))}
          </div>
        ) : tree.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-40" />
            <p>{language === 'ko' ? '영업 조직이 없습니다' : 'No sales organization found'}</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {tree.map((root) => (
              <TreeNodeComponent
                key={root.user_id}
                node={root}
                language={language}
                depth={0}
                draggedNode={draggedNode}
                dropTargetId={dropTargetId}
                tree={tree}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDropTarget={handleDropTarget}
                onDrop={handleDrop}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Reassignment Confirmation Dialog */}
      <AlertDialog open={confirmMove.open} onOpenChange={(open) => !reassigning && setConfirmMove({ ...confirmMove, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === 'ko' ? '멤버 재배치 확인' : 'Confirm Member Reassignment'}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                {language === 'ko'
                  ? '다음과 같이 멤버를 재배치하시겠습니까?'
                  : 'Are you sure you want to reassign this member?'}
              </p>
              <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">{language === 'ko' ? '이동 대상:' : 'Member:'}</span>
                  <span className="font-medium">{getDisplayName(confirmMove.source)}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {getRoleLabel(confirmMove.source?.sales_role || null)}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <ArrowRight className="h-3.5 w-3.5 text-primary" />
                  <span className="text-muted-foreground">{language === 'ko' ? '새 스폰서:' : 'New Sponsor:'}</span>
                  <span className="font-medium">{getDisplayName(confirmMove.target)}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {getRoleLabel(confirmMove.target?.sales_role || null)}
                  </Badge>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {language === 'ko'
                  ? '⚠️ 재배치 후 관련 커미션이 자동으로 재계산됩니다.'
                  : '⚠️ Commissions will be recalculated automatically after reassignment.'}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reassigning}>
              {language === 'ko' ? '취소' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              className="btn-gold"
              disabled={reassigning}
              onClick={(e) => { e.preventDefault(); executeReassignment(); }}
            >
              {reassigning
                ? (language === 'ko' ? '처리 중...' : 'Processing...')
                : (language === 'ko' ? '재배치' : 'Reassign')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={confirmDelete.open} onOpenChange={(open) => !deleting && setConfirmDelete({ ...confirmDelete, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === 'ko' ? '멤버 삭제 확인' : 'Confirm Member Deletion'}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                {language === 'ko'
                  ? `${getDisplayName(confirmDelete.node)} 멤버를 삭제하시겠습니까? (소프트 삭제 — 추후 복구 가능)`
                  : `Delete ${getDisplayName(confirmDelete.node)}? (Soft delete — can be restored later.)`}
              </p>
              {confirmDelete.node && confirmDelete.node.children.length > 0 && (
                <>
                  <p className="text-xs text-destructive">
                    {language === 'ko'
                      ? `⚠️ 이 멤버는 직속 하위 ${confirmDelete.node.children.length}명 (총 ${countDescendants(confirmDelete.node)}명) 을 가지고 있습니다.`
                      : `⚠️ This member has ${confirmDelete.node.children.length} direct downline (${countDescendants(confirmDelete.node)} total).`}
                  </p>
                  {confirmDelete.node.parent_id ? (
                    <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3">
                      <Checkbox
                        id="promote-children"
                        checked={promoteChildren}
                        onCheckedChange={(v) => setPromoteChildren(v === true)}
                        disabled={deleting}
                        className="mt-0.5"
                      />
                      <Label htmlFor="promote-children" className="text-xs leading-relaxed cursor-pointer">
                        {language === 'ko'
                          ? `직속 하위 ${confirmDelete.node.children.length}명을 상위 스폰서로 자동 승격`
                          : `Auto-promote ${confirmDelete.node.children.length} direct downline to the parent sponsor`}
                        <span className="block text-[10px] text-muted-foreground mt-0.5">
                          {language === 'ko'
                            ? '체크하지 않으면 하위 멤버는 그대로 유지됩니다 (고아 노드 발생 가능).'
                            : 'If unchecked, downline stays in place (may become orphaned).'}
                        </span>
                      </Label>
                    </div>
                  ) : (
                    <p className="text-[10px] text-muted-foreground">
                      {language === 'ko'
                        ? '※ 최상위 멤버이므로 하위 승격이 불가합니다.'
                        : '※ Root member — promotion is not possible.'}
                    </p>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              {language === 'ko' ? '취소' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={(e) => { e.preventDefault(); executeDelete(); }}
            >
              {deleting
                ? (language === 'ko' ? '삭제 중...' : 'Deleting...')
                : (language === 'ko' ? '삭제' : 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
