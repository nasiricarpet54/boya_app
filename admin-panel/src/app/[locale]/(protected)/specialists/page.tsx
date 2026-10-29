'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Plus, RefreshCw, Scissors, UserCheck } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/providers/ToastProvider';
import { getApiErrorMessage } from '@/lib/api/errors';
import { specialistsApi, type SpecialistItem } from '@/lib/api/specialists';
import { faDigits } from '@/lib/utils/persian';

export default function SpecialistsPage() {
  const tNav = useTranslations('nav');
  const toastContext = useToast() as any;
  const pushNotification = toastContext.toast || toastContext.showToast || toastContext.addToast || (() => {});
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [userId, setUserId] = useState('');
  const [bio, setBio] = useState('');
  const [skillsInput, setSkillsInput] = useState('');
  const [commissionRate, setCommissionRate] = useState('50');

  const { data: specialists = [], isLoading, isRefetching, refetch } = useQuery<SpecialistItem[]>({
    queryKey: ['specialists'],
    queryFn: () => specialistsApi.getSpecialists(),
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const skills = skillsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      return specialistsApi.createSpecialist({
        userId: userId.trim(),
        bio: bio.trim() || undefined,
        skills: skills.length > 0 ? skills : undefined,
        commissionRate: commissionRate ? Number(commissionRate) : 50,
      });
    },
    onSuccess: () => {
      pushNotification({ title: 'متخصص با موفقیت ثبت شد', tone: 'success' });
      setIsDialogOpen(false);
      setUserId('');
      setBio('');
      setSkillsInput('');
      setCommissionRate('50');
      queryClient.invalidateQueries({ queryKey: ['specialists'] });
    },
    onError: (err) => {
      pushNotification({ title: getApiErrorMessage(err, 'خطا در برقراری ارتباط'), tone: 'danger' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim()) {
      pushNotification({ title: 'شناسه کاربر الزامی است', tone: 'danger' });
      return;
    }
    createMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title={tNav('specialists')}
          subtitle="مدیریت، بررسی وضعیت و ثبت متخصصان سالن"
        />
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading || isRefetching}
          >
            <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
            بروزرسانی
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsDialogOpen(true)}
          >
            <Plus className="h-4 w-4" />
            افزودن متخصص
          </Button>
        </div>
      </div>

      <Card>
        <div className="p-4 border-b border-border/40 flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-brand" />
            فهرست متخصصان فعال ({faDigits(specialists.length)})
          </CardTitle>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-ink-muted">در حال بارگذاری اطلاعات...</div>
        ) : specialists.length === 0 ? (
          <div className="p-12 text-center text-ink-muted flex flex-col items-center gap-2">
            <Scissors className="h-8 w-8 text-ink-muted/50" />
            <span>هیچ متخصصی برای این سالن ثبت نشده است.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-surface-subtle text-ink-muted text-xs border-b border-border">
                <tr>
                  <th className="p-3">شناسه متخصص</th>
                  <th className="p-3">شناسه کاربر</th>
                  <th className="p-3">بیوگرافی</th>
                  <th className="p-3">مهارت‌ها</th>
                  <th className="p-3">کمیسیون</th>
                  <th className="p-3">سرویس سیار</th>
                  <th className="p-3">وضعیت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {specialists.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-subtle/50 transition-colors">
                    <td className="p-3 font-mono text-xs text-ink-muted">{item.id.slice(0, 8)}...</td>
                    <td className="p-3 font-mono text-xs">{item.userId.slice(0, 8)}...</td>
                    <td className="p-3 text-ink max-w-xs truncate">{item.bio || ''}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {item.skills && item.skills.length > 0 ? (
                          item.skills.map((skill, idx) => (
                            <Badge key={idx} tone="neutral">{skill}</Badge>
                          ))
                        ) : (
                          <span className="text-ink-muted text-xs"></span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 font-mono">{faDigits(item.commissionRate)}</td>
                    <td className="p-3">
                      <Badge tone={item.offersMobileService ? 'info' : 'neutral'}>
                        {item.offersMobileService ? 'دارد' : 'ندارد'}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Badge tone={item.isActive ? 'success' : 'neutral'}>
                        {item.isActive ? 'فعال' : 'غیرفعال'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title="افزودن متخصص جدید"
        description="اطلاعات متخصص را جهت اتصال به سالن وارد نمایید."
        footer={
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setIsDialogOpen(false)}
            >
              انصراف
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="create-specialist-form"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'در حال ثبت...' : 'ثبت متخصص'}
            </Button>
          </div>
        }
      >
        <form id="create-specialist-form" onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="شناسه کاربر (User UUID)"
            placeholder="مثال: e2b4a1c5-..."
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            required
          />
          <Input
            label="بیوگرافی و معرفی"
            placeholder="معرفی کوتاه، سابقه کاری و..."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
          <Input
            label="مهارت‌ها (با کاما جدا کنید)"
            placeholder="کوپ، رنگ و مش، میکاپ"
            value={skillsInput}
            onChange={(e) => setSkillsInput(e.target.value)}
          />
          <Input
            label="درصد کمیسیون ( تا )"
            type="number"
            min={0}
            max={100}
            value={commissionRate}
            onChange={(e) => setCommissionRate(e.target.value)}
          />
        </form>
      </Dialog>
    </div>
  );
}