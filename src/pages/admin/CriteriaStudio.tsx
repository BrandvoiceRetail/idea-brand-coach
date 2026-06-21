/**
 * Criteria Studio — Trevor's non-technical authoring surface.
 *
 * Lets a non-technical author add/edit/weight/toggle the Coach Criteria that both STEER the
 * live coach (compiled into a steering preamble) and are SCORED by the live judge. Edits persist
 * to localStorage and can be exported as JSON to commit into src/mcp/evals/criteria/catalog.ts.
 * (DB-backed, per-team persistence is the next step — see the gap analysis.)
 */
import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, RotateCcw, Save, Download, Wand2 } from 'lucide-react';
import {
  DEFAULT_CRITERIA_SET,
  STORAGE_KEY,
  criteriaSteeringPreamble,
} from '@/mcp/evals/criteria/catalog';
import type { CoachCriterion, CriteriaSet, CriterionCategory, CriterionPolarity } from '@/mcp/evals/criteria/types';
import { ICPS } from '@/mcp/evals/icp/profiles';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

const BRAND_BLUE = '#1A3557';
const BRAND_GOLD = '#C9A84C';
const CATEGORIES: CriterionCategory[] = ['framing', 'evidence', 'persona', 'recommendation', 'output', 'safety', 'voice'];

function loadSet(): CriteriaSet {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as CriteriaSet;
  } catch {
    /* ignore corrupt storage */
  }
  return structuredClone(DEFAULT_CRITERIA_SET);
}

export default function CriteriaStudio() {
  const [set, setSet] = useState<CriteriaSet>(() =>
    typeof window === 'undefined' ? structuredClone(DEFAULT_CRITERIA_SET) : loadSet(),
  );
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setSet(loadSet());
  }, []);

  const update = (id: string, patch: Partial<CoachCriterion>) => {
    setSet((s) => ({ ...s, criteria: s.criteria.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
    setDirty(true);
  };
  const remove = (id: string) => {
    setSet((s) => ({ ...s, criteria: s.criteria.filter((c) => c.id !== id) }));
    setDirty(true);
  };
  const add = () => {
    const n = set.criteria.length + 1;
    setSet((s) => ({
      ...s,
      criteria: [
        ...s.criteria,
        {
          id: `custom-${n}`,
          title: 'New criterion',
          description: 'What good looks like, in your words.',
          category: 'framing',
          icpScope: 'all',
          weight: 3,
          polarity: 'reward',
          optimizeToward: 'Describe the behaviour or recommendation to optimise toward.',
          enabled: true,
        },
      ],
    }));
    setDirty(true);
  };
  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(set));
    setDirty(false);
  };
  const reset = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSet(structuredClone(DEFAULT_CRITERIA_SET));
    setDirty(false);
  };

  const preview = useMemo(() => criteriaSteeringPreamble(set), [set]);
  const exportJson = useMemo(() => JSON.stringify(set, null, 2), [set]);
  const activeCount = set.criteria.filter((c) => c.enabled).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h2 className="text-xl font-extrabold" style={{ color: BRAND_BLUE }}>Criteria Studio</h2>
          <p className="text-sm text-muted-foreground">
            Define how the coach should behave — in your words. {activeCount} active of {set.criteria.length}. These steer the live coach and are scored by the judge.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={add}><Plus className="mr-1 h-4 w-4" />Add criterion</Button>
        <Button variant="outline" size="sm" onClick={reset}><RotateCcw className="mr-1 h-4 w-4" />Reset</Button>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm"><Download className="mr-1 h-4 w-4" />Export</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Export criteria JSON</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">Paste this into <code>src/mcp/evals/criteria/catalog.ts</code> (DEFAULT_CRITERIA_SET) to commit it so it steers the deployed coach + CLI evals.</p>
            <Textarea readOnly value={exportJson} className="h-80 font-mono text-xs" />
          </DialogContent>
        </Dialog>
        <Button size="sm" onClick={save} disabled={!dirty} style={{ backgroundColor: BRAND_BLUE }}>
          <Save className="mr-1 h-4 w-4" />{dirty ? 'Save' : 'Saved'}
        </Button>
      </div>

      {/* Live steering preview */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base" style={{ color: BRAND_BLUE }}>
            <Wand2 className="h-4 w-4" /> How this steers the coach (live preview)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-xs">{preview || '(no active criteria)'}</pre>
        </CardContent>
      </Card>

      <Separator />

      {/* Criteria editors */}
      <div className="space-y-4">
        {set.criteria.map((c) => (
          <Card key={c.id} className={c.enabled ? undefined : 'opacity-60'}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <Switch checked={c.enabled} onCheckedChange={(v) => update(c.id, { enabled: v })} />
                <Input
                  value={c.title}
                  onChange={(e) => update(c.id, { title: e.target.value })}
                  className="font-semibold"
                  style={{ color: BRAND_BLUE }}
                />
                <Badge
                  className="cursor-pointer border"
                  style={c.polarity === 'reward' ? { background: '#ECFDF3', color: '#027A48', borderColor: '#A6E0BF' } : { background: '#FEF3F2', color: '#B42318', borderColor: '#FDA29B' }}
                  onClick={() => update(c.id, { polarity: c.polarity === 'reward' ? 'avoid' : ('reward' as CriterionPolarity) })}
                >
                  {c.polarity === 'reward' ? 'Reward' : 'Avoid'}
                </Badge>
                <Button variant="ghost" size="icon" onClick={() => remove(c.id)} aria-label="Delete criterion">
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">What good looks like</Label>
                <Textarea value={c.description} onChange={(e) => update(c.id, { description: e.target.value })} className="mt-1 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Optimise the AI toward… (the steering directive)</Label>
                <Textarea value={c.optimizeToward} onChange={(e) => update(c.id, { optimizeToward: e.target.value })} className="mt-1 text-sm" />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label className="text-xs">Importance: {c.weight}</Label>
                  <Slider className="mt-3" min={1} max={5} step={1} value={[c.weight]} onValueChange={([v]) => update(c.id, { weight: v })} />
                </div>
                <div>
                  <Label className="text-xs">Applies to</Label>
                  <Select value={c.icpScope} onValueChange={(v) => update(c.id, { icpScope: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All customers</SelectItem>
                      {ICPS.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.codename} — {p.role.split(';')[0]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Category</Label>
                  <Select value={c.category} onValueChange={(v) => update(c.id, { category: v as CriterionCategory })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground" style={{ borderTop: `2px solid ${BRAND_GOLD}`, paddingTop: 8 }}>
        Edits save to this browser. Use <strong>Export</strong> to commit them so they steer the deployed coach and the CLI evals. DB-backed, per-team criteria are the next step.
      </p>
    </div>
  );
}
