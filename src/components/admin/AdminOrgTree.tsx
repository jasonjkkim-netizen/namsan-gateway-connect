import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronDown, ChevronRight, Crown, Building2, UserCog, Users, User, RefreshCw } from 'lucide-react';

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

const ROLE_LABELS: Record<string, { en: string; ko: string }> = {
  district_manager: { en: 'General Manager', ko: '총괄관리' },
  principal_agent: { en: 'Principal Agent', ko: '수석 에이전트' },
  agent: { en: 'Agent', ko: '에이전트' },
  client: { en: 'Client', ko: '고객' },
};

const ROLE_ICONS: Record<string, typeof Building2> = {
  district_manager: Building2,
  principal_agent: UserCog,
  agent: Users,
  client: User,
};

const ROLE_COLORS: Record<string, string> = {
  district_manager: 'bg-primary text-primary-foreground',
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

function TreeNodeComponent({ node, language, depth = 0 }: { node: TreeNode; language: string; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const role = node.sales_role || 'client';
  const Icon = ROLE_ICONS[role] || User;
  const roleLabel = ROLE_LABELS[role];
  const displayName = language === 'ko' && node.full_name_ko ? node.full_name_ko : node.full_name;

  return (
    <div>
      <div
        className="flex items-center gap-2 group cursor-pointer rounded-lg px-3 py-2.5 transition-colors hover:bg-accent/50"
        style={{ paddingLeft: `${depth * 28 + 12}px` }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {/* Expand/Collapse */}
        <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
          {hasChildren ? (
            expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )
          ) : (
            <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
          )}
        </div>

        {/* Icon */}
        <div className={`rounded-full p-1.5 flex-shrink-0 ${ROLE_COLORS[role]}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>

        {/* Name & Info */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="font-medium text-sm truncate">{displayName}</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 flex-shrink-0">
            {language === 'ko' ? roleLabel?.ko : roleLabel?.en}
          </Badge>
          {node.sales_status && (
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[node.sales_status] || 'bg-muted-foreground'}`} title={node.sales_status} />
          )}
        </div>

        {/* Email */}
        <span className="text-xs text-muted-foreground hidden md:inline truncate max-w-[200px]">
          {node.email}
        </span>

        {/* Children count */}
        {hasChildren && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 flex-shrink-0">
            {node.children.length}
          </Badge>
        )}
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div className="relative">
          {/* Vertical connector line */}
          <div
            className="absolute top-0 bottom-0 border-l border-border"
            style={{ left: `${depth * 28 + 24}px` }}
          />
          {node.children.map((child) => (
            <TreeNodeComponent
              key={child.user_id}
              node={child}
              language={language}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminOrgTree() {
  const { language } = useLanguage();
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, roles: {} as Record<string, number> });

  const buildTree = useCallback((profiles: any[]): TreeNode[] => {
    const nodeMap = new Map<string, TreeNode>();

    // Create nodes
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

    // Build parent-child relationships
    nodeMap.forEach((node) => {
      if (node.parent_id && nodeMap.has(node.parent_id)) {
        nodeMap.get(node.parent_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    });

    // Sort children by role level then name
    const ROLE_ORDER: Record<string, number> = {
      district_manager: 1,
      principal_agent: 2,
      agent: 3,
      client: 4,
    };

    const sortChildren = (nodes: TreeNode[]) => {
      nodes.sort((a, b) => {
        const aOrder = ROLE_ORDER[a.sales_role || 'client'] || 5;
        const bOrder = ROLE_ORDER[b.sales_role || 'client'] || 5;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.full_name.localeCompare(b.full_name);
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
      .not('sales_role', 'is', null)
      .order('sales_level', { ascending: true });

    const profiles = data || [];
    const treeData = buildTree(profiles);
    setTree(treeData);

    // Stats
    const roleCounts: Record<string, number> = {};
    profiles.forEach((p) => {
      const role = p.sales_role || 'unknown';
      roleCounts[role] = (roleCounts[role] || 0) + 1;
    });
    setStats({ total: profiles.length, roles: roleCounts });

    setLoading(false);
  }, [buildTree]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="card-elevated">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-serif font-semibold">
              {language === 'ko' ? '영업 조직도' : 'Sales Organization Tree'}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {language === 'ko'
                ? `총 ${stats.total}명의 영업 사용자`
                : `${stats.total} total sales users`}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            {language === 'ko' ? '새로고침' : 'Refresh'}
          </Button>
        </div>

        {/* Role breakdown */}
        {!loading && stats.total > 0 && (
          <div className="flex gap-3 mt-4 flex-wrap">
            {Object.entries(ROLE_LABELS).map(([key, labels]) => {
              const count = stats.roles[key] || 0;
              if (count === 0) return null;
              const Icon = ROLE_ICONS[key] || User;
              return (
                <div key={key} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" />
                  <span>{language === 'ko' ? labels.ko : labels.en}</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                    {count}
                  </Badge>
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
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
