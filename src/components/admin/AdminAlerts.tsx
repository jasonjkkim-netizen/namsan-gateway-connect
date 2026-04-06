import { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { RefreshCw, Send, Bell, BellOff, Search, Eye, BookOpen, Star, PlayCircle, Briefcase, DollarSign, Mail, MessageSquare, Phone, FileText } from 'lucide-react';
import { format } from 'date-fns';

interface AlertSetting {
  id: string;
  category: string;
  channel: string;
  is_enabled: boolean;
  updated_at: string;
}

interface AlertLogEntry {
  id: string;
  category: string;
  channel: string;
  recipient_user_id: string;
  recipient_name: string | null;
  recipient_email: string | null;
  subject: string;
  sent_at: string;
  sent_by: string | null;
  is_manual: boolean;
}

interface ClientProfile {
  user_id: string;
  full_name: string;
  full_name_ko: string | null;
  email: string;
  phone: string | null;
  is_approved: boolean;
}

const CATEGORY_LABELS: Record<string, { ko: string; en: string; icon: typeof Bell }> = {
  viewpoint: { ko: '뷰포인트', en: 'Viewpoint', icon: Eye },
  blog: { ko: '블로그', en: 'Blog', icon: BookOpen },
  stock_pick: { ko: '관심 종목', en: 'Stock Pick', icon: Star },
  video: { ko: '비디오', en: 'Video', icon: PlayCircle },
  investment: { ko: '투자', en: 'Investment', icon: Briefcase },
  research: { ko: '텔레그램 리서치', en: 'Telegram Research', icon: FileText },
};

const CHANNEL_LABELS: Record<string, { ko: string; en: string; icon: typeof Mail; color: string }> = {
  email: { ko: '이메일', en: 'Email', icon: Mail, color: 'text-blue-500' },
  kakao: { ko: '카카오톡', en: 'KakaoTalk', icon: MessageSquare, color: 'text-yellow-500' },
  sms: { ko: 'SMS', en: 'SMS', icon: Phone, color: 'text-green-500' },
};

export function AdminAlerts() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [settings, setSettings] = useState<AlertSetting[]>([]);
  const [logs, setLogs] = useState<AlertLogEntry[]>([]);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterChannel, setFilterChannel] = useState('all');

  // Manual send dialog
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendForm, setSendForm] = useState({
    recipient_user_id: '',
    category: 'viewpoint',
    channel: 'email',
    subject: '',
    message: '',
  });
  const [sending, setSending] = useState(false);
  const [bulkSending, setBulkSending] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [settingsRes, logsRes, clientsRes] = await Promise.all([
      supabase.from('alert_settings').select('*').order('category').order('channel'),
      supabase.from('alert_log').select('*').order('sent_at', { ascending: false }).limit(200),
      supabase.from('profiles').select('user_id, full_name, full_name_ko, email, phone, is_approved').eq('is_approved', true),
    ]);

    if (settingsRes.data) setSettings(settingsRes.data as AlertSetting[]);
    if (logsRes.data) setLogs(logsRes.data as AlertLogEntry[]);
    if (clientsRes.data) setClients(clientsRes.data as ClientProfile[]);
    setLoading(false);
  }

  async function toggleSetting(setting: AlertSetting) {
    const newVal = !setting.is_enabled;

    // SMS is not yet connected
    if (newVal && setting.channel === 'sms') {
      const channelName = CHANNEL_LABELS[setting.channel];
      toast.error(
        language === 'ko'
          ? `${channelName.ko} 채널은 아직 연동되지 않았습니다. 대행사 설정 후 활성화할 수 있습니다.`
          : `${channelName.en} channel is not yet connected. You can enable it after configuring the provider.`
      );
      return;
    }

    const { error } = await supabase
      .from('alert_settings')
      .update({ is_enabled: newVal, updated_at: new Date().toISOString(), updated_by: user?.id })
      .eq('id', setting.id);

    if (error) {
      toast.error(language === 'ko' ? '설정 변경 실패' : 'Failed to update setting');
      return;
    }

    setSettings(prev => prev.map(s => s.id === setting.id ? { ...s, is_enabled: newVal } : s));
    const catLabel = CATEGORY_LABELS[setting.category];
    const chLabel = CHANNEL_LABELS[setting.channel];
    toast.success(
      language === 'ko'
        ? `${catLabel?.ko} (${chLabel?.ko}) 알림이 ${newVal ? '활성화' : '비활성화'}되었습니다`
        : `${catLabel?.en} (${chLabel?.en}) alerts ${newVal ? 'enabled' : 'disabled'}`
    );
  }

  async function handleManualSend() {
    if (!sendForm.recipient_user_id || !sendForm.subject) {
      toast.error(language === 'ko' ? '수신자와 제목을 입력해주세요' : 'Please fill in recipient and subject');
      return;
    }

    // Block sms for now
    if (sendForm.channel === 'sms') {
      const chLabel = CHANNEL_LABELS[sendForm.channel];
      toast.error(
        language === 'ko'
          ? `${chLabel?.ko} 채널은 아직 연동되지 않았습니다.`
          : `${chLabel?.en} channel is not yet connected.`
      );
      return;
    }

    setSending(true);
    try {
      const recipient = clients.find(c => c.user_id === sendForm.recipient_user_id);
      if (!recipient) throw new Error('Recipient not found');

      if (sendForm.channel === 'email') {
        const { error } = await supabase.functions.invoke('send-newsletter', {
          body: {
            subject: `[Namsan Partners] ${sendForm.subject}`,
            htmlContent: `
              <div style="margin-bottom: 16px;">
                <span style="display: inline-block; background: #e2e8f0; color: #1a365d; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600;">
                  ${CATEGORY_LABELS[sendForm.category]?.ko || sendForm.category} / ${CATEGORY_LABELS[sendForm.category]?.en || sendForm.category}
                </span>
              </div>
              <p style="color: #2d3748; font-size: 14px; line-height: 1.6;">${sendForm.message || sendForm.subject}</p>
              <div style="margin-top: 24px;">
                <a href="https://namsan-gateway-connect.lovable.app" style="display: inline-block; background: #1a365d; color: white; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-size: 14px;">
                  포털 방문 / Visit Portal
                </a>
              </div>
            `,
            targetEmail: recipient.email,
          },
        });
        if (error) throw error;
      } else if (sendForm.channel === 'kakao') {
        const kakaoMessage = `[남산파트너스] ${sendForm.subject}\n\n${sendForm.message || sendForm.subject}`;
        const { error } = await supabase.functions.invoke('send-kakao', {
          body: {
            message: kakaoMessage,
            templateObject: {
              object_type: 'text',
              text: kakaoMessage,
              link: {
                web_url: 'https://namsan-gateway-connect.lovable.app',
                mobile_web_url: 'https://namsan-gateway-connect.lovable.app',
              },
              button_title: '포털 방문',
            },
          },
        });
        if (error) throw error;
      }

      await supabase.from('alert_log').insert({
        category: sendForm.category,
        channel: sendForm.channel,
        recipient_user_id: recipient.user_id,
        recipient_name: recipient.full_name,
        recipient_email: recipient.email,
        subject: sendForm.subject,
        sent_by: user?.id,
        is_manual: true,
      });

      toast.success(language === 'ko' ? `${recipient.full_name}에게 알림을 발송했습니다` : `Alert sent to ${recipient.full_name}`);
      setSendDialogOpen(false);
      setSendForm({ recipient_user_id: '', category: 'viewpoint', channel: 'email', subject: '', message: '' });
      fetchAll();
    } catch (err: any) {
      toast.error(language === 'ko' ? `발송 실패: ${err.message}` : `Send failed: ${err.message}`);
    } finally {
      setSending(false);
    }
  }

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (filterCategory !== 'all' && log.category !== filterCategory) return false;
      if (filterChannel !== 'all' && log.channel !== filterChannel) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          (log.recipient_name?.toLowerCase().includes(term)) ||
          (log.recipient_email?.toLowerCase().includes(term)) ||
          log.subject.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [logs, filterCategory, filterChannel, searchTerm]);

  const getClientName = (c: ClientProfile) => {
    return language === 'ko' && c.full_name_ko ? c.full_name_ko : c.full_name;
  };

  // Group settings by category
  const settingsByCategory = useMemo(() => {
    const map: Record<string, AlertSetting[]> = {};
    for (const s of settings) {
      if (!map[s.category]) map[s.category] = [];
      map[s.category].push(s);
    }
    return map;
  }, [settings]);

  return (
    <div className="space-y-6">
      {/* Category × Channel Toggles */}
      <div className="card-elevated p-6">
        <h3 className="text-lg font-serif font-semibold mb-4">
          {language === 'ko' ? '카테고리별 알림 채널 설정' : 'Alert Channel Settings by Category'}
        </h3>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === 'ko' ? '카테고리' : 'Category'}</TableHead>
                  {Object.entries(CHANNEL_LABELS).map(([key, ch]) => {
                    const Icon = ch.icon;
                    return (
                      <TableHead key={key} className="text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Icon className={`h-4 w-4 ${ch.color}`} />
                          <span>{language === 'ko' ? ch.ko : ch.en}</span>
                        </div>
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(CATEGORY_LABELS).map(([catKey, catMeta]) => {
                  const Icon = catMeta.icon;
                  const channelSettings = settingsByCategory[catKey] || [];
                  return (
                    <TableRow key={catKey}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{language === 'ko' ? catMeta.ko : catMeta.en}</span>
                        </div>
                      </TableCell>
                      {Object.keys(CHANNEL_LABELS).map(chKey => {
                        const setting = channelSettings.find(s => s.channel === chKey);
                        const isSms = chKey === 'sms';
                        return (
                          <TableCell key={chKey} className="text-center">
                            {setting ? (
                              <div className="flex flex-col items-center gap-1">
                                <Switch
                                  checked={setting.is_enabled}
                                  onCheckedChange={() => toggleSetting(setting)}
                                />
                                {isSms && (
                                  <span className="text-[10px] text-muted-foreground">
                                    {language === 'ko' ? '미연동' : 'Not connected'}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Alert Log */}
      <div className="card-elevated p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="text-lg font-serif font-semibold">
            {language === 'ko' ? '알림 발송 기록' : 'Alert Send Log'}
            <span className="text-sm font-normal text-muted-foreground ml-2">({filteredLogs.length})</span>
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={language === 'ko' ? '검색...' : 'Search...'}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 w-[180px]"
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{language === 'ko' ? '전체' : 'All'}</SelectItem>
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{language === 'ko' ? label.ko : label.en}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterChannel} onValueChange={setFilterChannel}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{language === 'ko' ? '전체 채널' : 'All Channels'}</SelectItem>
                {Object.entries(CHANNEL_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{language === 'ko' ? label.ko : label.en}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => setSendDialogOpen(true)}>
              <Send className="h-4 w-4 mr-1" />
              {language === 'ko' ? '수동 발송' : 'Manual Send'}
            </Button>
            <Button size="sm" variant="secondary" disabled={bulkSending} onClick={async () => {
              setBulkSending(true);
              try {
                const { data, error } = await supabase.functions.invoke('notify-sales', {
                  body: { type: 'bulk_role_notification' },
                });
                if (error) throw error;
                toast.success(
                  language === 'ko'
                    ? `${data?.sent || 0}명에게 역할 안내 메일을 발송했습니다`
                    : `Role notification sent to ${data?.sent || 0} users`
                );
                fetchAll();
              } catch (e) {
                console.error(e);
                toast.error(language === 'ko' ? '일괄 발송 실패' : 'Bulk send failed');
              } finally {
                setBulkSending(false);
              }
            }}>
              <Mail className="h-4 w-4 mr-1" />
              {bulkSending 
                ? (language === 'ko' ? '발송 중...' : 'Sending...') 
                : (language === 'ko' ? '역할 일괄 안내' : 'Bulk Role Notify')}
            </Button>
            <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === 'ko' ? '수신자' : 'Recipient'}</TableHead>
                <TableHead>{language === 'ko' ? '이메일' : 'Email'}</TableHead>
                <TableHead>{language === 'ko' ? '카테고리' : 'Category'}</TableHead>
                <TableHead>{language === 'ko' ? '채널' : 'Channel'}</TableHead>
                <TableHead>{language === 'ko' ? '제목' : 'Subject'}</TableHead>
                <TableHead>{language === 'ko' ? '유형' : 'Type'}</TableHead>
                <TableHead>{language === 'ko' ? '발송일시' : 'Sent At'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-20" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    <BellOff className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    {language === 'ko' ? '알림 기록이 없습니다' : 'No alert records found'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map(log => {
                  const catLabel = CATEGORY_LABELS[log.category];
                  const chLabel = CHANNEL_LABELS[log.channel];
                  const ChIcon = chLabel?.icon || Mail;
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">{log.recipient_name || '—'}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{log.recipient_email || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {language === 'ko' ? catLabel?.ko : catLabel?.en || log.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <ChIcon className={`h-3.5 w-3.5 ${chLabel?.color || ''}`} />
                          <span className="text-xs">{language === 'ko' ? chLabel?.ko : chLabel?.en || log.channel}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">{log.subject}</TableCell>
                      <TableCell>
                        <Badge variant={log.is_manual ? 'default' : 'secondary'} className="text-xs">
                          {log.is_manual
                            ? (language === 'ko' ? '수동' : 'Manual')
                            : (language === 'ko' ? '자동' : 'Auto')
                          }
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(log.sent_at), 'yyyy-MM-dd HH:mm')}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Manual Send Dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{language === 'ko' ? '수동 알림 발송' : 'Send Manual Alert'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{language === 'ko' ? '수신자' : 'Recipient'}</Label>
              <Select value={sendForm.recipient_user_id} onValueChange={v => setSendForm(f => ({ ...f, recipient_user_id: v }))}>
                <SelectTrigger><SelectValue placeholder={language === 'ko' ? '고객 선택' : 'Select client'} /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.user_id} value={c.user_id}>
                      {getClientName(c)} ({c.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{language === 'ko' ? '카테고리' : 'Category'}</Label>
              <Select value={sendForm.category} onValueChange={v => setSendForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{language === 'ko' ? label.ko : label.en}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{language === 'ko' ? '발송 채널' : 'Channel'}</Label>
              <Select value={sendForm.channel} onValueChange={v => setSendForm(f => ({ ...f, channel: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CHANNEL_LABELS).map(([key, label]) => {
                    const Icon = label.icon;
                    const disabled = key === 'sms';
                    return (
                      <SelectItem key={key} value={key} disabled={disabled}>
                        <div className="flex items-center gap-2">
                          <Icon className={`h-4 w-4 ${label.color}`} />
                          <span>{language === 'ko' ? label.ko : label.en}</span>
                          {disabled && <span className="text-xs text-muted-foreground ml-1">({language === 'ko' ? '미연동' : 'N/A'})</span>}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{language === 'ko' ? '제목' : 'Subject'}</Label>
              <Input
                value={sendForm.subject}
                onChange={e => setSendForm(f => ({ ...f, subject: e.target.value }))}
                placeholder={language === 'ko' ? '알림 제목' : 'Alert subject'}
              />
            </div>
            <div>
              <Label>{language === 'ko' ? '메시지 (선택)' : 'Message (optional)'}</Label>
              <Textarea
                value={sendForm.message}
                onChange={e => setSendForm(f => ({ ...f, message: e.target.value }))}
                placeholder={language === 'ko' ? '알림 내용' : 'Alert message'}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialogOpen(false)}>
              {language === 'ko' ? '취소' : 'Cancel'}
            </Button>
            <Button onClick={handleManualSend} disabled={sending}>
              {sending ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
              {language === 'ko' ? '발송' : 'Send'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
