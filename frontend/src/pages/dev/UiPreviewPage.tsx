import React, { useState } from 'react';
import { ArrowRight, Clock, Compass, Eye, EyeOff, Flag, RotateCw, X } from 'lucide-react';
import {
  Badge,
  Button,
  Checkbox,
  ChoiceCard,
  ChoiceGroup,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  Input,
  LoadingState,
  ProgressBar,
  SegmentedControl,
  Select,
  SheetContent,
  SkipLink,
  StepMarker,
  Surface,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  TextLink,
} from '../../components/ui';
import type { StepState } from '../../components/ui';

/* Development-only: every primitive in every state, for visual and keyboard checks. Not routed in production. */

const swatches = [
  ['background', 'bg-background'],
  ['surface', 'bg-surface'],
  ['surface-elevated', 'bg-surface-elevated'],
  ['surface-inverse', 'bg-surface-inverse'],
  ['text', 'bg-text'],
  ['text-secondary', 'bg-text-secondary'],
  ['text-muted', 'bg-text-muted'],
  ['accent', 'bg-accent'],
  ['accent-hover', 'bg-accent-hover'],
  ['accent-on-inverse', 'bg-accent-on-inverse'],
  ['achievement', 'bg-achievement'],
  ['caution', 'bg-caution'],
  ['danger', 'bg-danger'],
  ['border-strong', 'bg-border-strong'],
  ['border-control', 'bg-border-control'],
] as const;

const typeScale = [
  ['display', 'text-display', 'Your ambition'],
  ['h1', 'text-h1', 'Know where you’re going'],
  ['h2', 'text-h2', 'Phase 2 · Acceleration'],
  ['h3', 'text-h3', 'Thumbnail framing and a hook'],
  ['body-lg', 'text-body-lg', 'Every step says why it matters today.'],
  ['body', 'text-body', 'Every step says why it matters today, so it never feels like busywork.'],
  ['small', 'text-small', 'Short on time? Write one hook and read it aloud.'],
] as const;

const markers: StepState[] = ['upcoming', 'active', 'completed', 'milestone', 'destination'];

const Block: React.FC<{ id: string; title: string; children: React.ReactNode }> = ({ id, title, children }) => (
  <section aria-labelledby={id} className="border-t border-border py-12">
    <h2 id={id} className="mb-8 font-ui-mono text-micro uppercase text-text-secondary">
      {title}
    </h2>
    {children}
  </section>
);

const UiPreviewPage: React.FC = () => {
  const [budget, setBudget] = useState<string | undefined>('30');
  const [slot, setSlot] = useState<string | undefined>('evening');
  const [level, setLevel] = useState<string | undefined>();
  const [showPassword, setShowPassword] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const retry = () => {
    setRetrying(true);
    window.setTimeout(() => setRetrying(false), 1500);
  };

  return (
    <div className="ui-root min-h-[100dvh] bg-background">
      <SkipLink />
      <main id="main" className="mx-auto w-full max-w-5xl px-gutter py-16">
        <p className="font-ui-mono text-micro uppercase text-accent-hover">Development only</p>
        <h1 className="mt-4 text-h1">Achivii primitives</h1>
        <p className="mt-4 max-w-2xl text-body-lg text-text-secondary">
          Every component in <code className="font-ui-mono text-small">components/ui</code>, in every state. Use Tab to check focus.
        </p>

        <Block id="tokens" title="Colour roles">
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
            {swatches.map(([name, cls]) => (
              <li key={name} className="flex flex-col gap-2">
                <span className={`h-14 rounded-block border border-border ${cls}`} />
                <span className="font-ui-mono text-micro text-text-secondary normal-case tracking-normal">{name}</span>
              </li>
            ))}
          </ul>
        </Block>

        <Block id="type" title="Type scale">
          <div className="flex flex-col gap-6">
            {typeScale.map(([name, cls, sample]) => (
              <div key={name} className="grid gap-2 sm:grid-cols-[6rem_1fr] sm:items-baseline">
                <span className="font-ui-mono text-micro uppercase text-text-secondary">{name}</span>
                <span className={`${cls} text-text`}>{sample}</span>
              </div>
            ))}
            <div className="grid gap-2 sm:grid-cols-[6rem_1fr] sm:items-baseline">
              <span className="font-ui-mono text-micro uppercase text-text-secondary">micro</span>
              <span className="font-ui-mono text-micro uppercase text-text-secondary">Week 4 · Foundation</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-[6rem_1fr] sm:items-end">
              <span className="font-ui-mono text-micro uppercase text-text-secondary">numeral</span>
              <span className="flex items-end gap-4">
                <span className="tabular text-numeral text-text">27</span>
                <span className="pb-2 font-ui-mono text-micro uppercase text-text-secondary">/ 90 days</span>
              </span>
            </div>
          </div>
        </Block>

        <Block id="buttons" title="Buttons">
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <Button trailingIcon={<ArrowRight aria-hidden="true" strokeWidth={1.75} className="size-4" />}>Start your journey</Button>
              <Button variant="secondary">See the journey</Button>
              <Button variant="quiet">Not now</Button>
              <Button variant="premium" leadingIcon={<Flag aria-hidden="true" strokeWidth={1.5} className="size-4" />}>
                See your milestone
              </Button>
              <Button variant="danger">Reset goal</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
              <Button loading>Creating your journey</Button>
              <Button disabled>Disabled</Button>
              <Button variant="secondary" disabled>
                Disabled
              </Button>
              <Button asChild variant="secondary">
                <a href="#tabs">As a link</a>
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <IconButton label="Close" icon={<X aria-hidden="true" strokeWidth={1.5} className="size-5" />} />
              <IconButton variant="secondary" label="Open schedule" icon={<Clock aria-hidden="true" strokeWidth={1.5} className="size-5" />} />
              <IconButton label="Refreshing" loading icon={<RotateCw aria-hidden="true" strokeWidth={1.5} className="size-5" />} />
              <IconButton label="Disabled action" disabled icon={<Clock aria-hidden="true" strokeWidth={1.5} className="size-5" />} />
            </div>
            <p className="text-small text-text-secondary">
              Already have an account? <TextLink href="#fields">Sign in</TextLink>
            </p>
            <Button fullWidth className="sm:hidden">
              Full width (mobile)
            </Button>
          </div>
        </Block>

        <Block id="fields" title="Fields">
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Email" hint="We only use it to sign you in.">
              <Input type="email" placeholder="you@example.com" autoComplete="email" />
            </Field>
            <Field label="Password" error="Use at least 8 characters.">
              <Input
                type={showPassword ? 'text' : 'password'}
                defaultValue="short"
                autoComplete="new-password"
                trailing={
                  <IconButton
                    label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((shown) => !shown)}
                    icon={
                      showPassword ? (
                        <EyeOff aria-hidden="true" strokeWidth={1.5} className="size-5" />
                      ) : (
                        <Eye aria-hidden="true" strokeWidth={1.5} className="size-5" />
                      )
                    }
                  />
                }
              />
            </Field>
            <Field label="Current level" showOptional>
              <Select defaultValue="beginner">
                <option value="beginner">Complete beginner</option>
                <option value="some">Some experience</option>
                <option value="regular">I practise regularly</option>
              </Select>
            </Field>
            <Field label="Disabled">
              <Input disabled defaultValue="Can't edit this" />
            </Field>
            <Field label="What does success look like on day 90?" className="sm:col-span-2">
              <Textarea placeholder="Twelve videos published, and a routine I can keep." />
            </Field>
          </div>
        </Block>

        <Block id="choices" title="Choices">
          <div className="flex flex-col gap-10">
            <ChoiceGroup legend="How much time can you give each day?" value={budget} onChange={setBudget} columns={3}>
              <ChoiceCard value="30" title="30 minutes" description="A light, steady pace." meta="3.5 h a week" />
              <ChoiceCard value="60" title="60 minutes" description="The recommended pace." meta="7 h a week" />
              <ChoiceCard value="90" title="90 minutes" description="Not available for this pathway." meta="10.5 h a week" disabled />
            </ChoiceGroup>
            <SegmentedControl
              legend="When do you work on it?"
              value={slot}
              onChange={setSlot}
              options={[
                { value: 'morning', label: 'Morning' },
                { value: 'afternoon', label: 'Afternoon' },
                { value: 'evening', label: 'Evening' },
              ]}
              className="max-w-md"
            />
            <ChoiceGroup
              legend="Where are you starting from?"
              value={level}
              onChange={setLevel}
              required
              error={level ? undefined : 'Choose where you’re starting from.'}
              columns={2}
            >
              <ChoiceCard value="new" title="Complete beginner" />
              <ChoiceCard value="some" title="Some experience" />
            </ChoiceGroup>
            <SegmentedControl
              legend="Session length"
              value={undefined}
              onChange={() => undefined}
              error="Choose a session length."
              options={[
                { value: '30', label: '30 min' },
                { value: '60', label: '60 min' },
              ]}
              className="max-w-md"
            />
            <div className="flex flex-col">
              <Checkbox label="Include weekends" description="Sessions can be planned on Saturday and Sunday." />
              <Checkbox label="I understand this goal will be archived" error="Confirm this to continue." />
              <Checkbox label="Disabled option" disabled />
            </div>
          </div>
        </Block>

        <Block id="surfaces" title="Surfaces and badges">
          <div className="grid gap-4 sm:grid-cols-2">
            <Surface>
              <p className="text-body font-medium">Base</p>
              <p className="mt-1 text-small text-text-secondary">Default app card.</p>
            </Surface>
            <Surface tone="elevated">
              <p className="text-body font-medium">Elevated</p>
              <p className="mt-1 text-small text-text-secondary">Raised above the page, with a deep shadow.</p>
            </Surface>
            <Surface tone="inset" radius="block">
              <p className="text-body font-medium">Inset, block radius</p>
              <p className="mt-1 text-small text-text-secondary">Architectural, near-rectangular.</p>
            </Surface>
            <Surface tone="inverse">
              <p className="text-body font-medium">Inverse</p>
              <p className="mt-1 text-small">
                Text and <TextLink href="#surfaces">text links</TextLink> only, for now. Other primitives have no inverse variant yet.
              </p>
            </Surface>
            <div
              className="relative overflow-hidden rounded-panel bg-cover bg-center p-6 sm:col-span-2 sm:p-10"
              style={{ backgroundImage: 'url(/images/brand/garden.jpg)' }}
            >
              <div aria-hidden="true" className="absolute inset-0 bg-background/40" />
              <Surface tone="glass" radius="panel" className="relative max-w-sm">
                <p className="text-body font-medium">Glass</p>
                <p className="mt-1 text-small text-text-secondary">Only over imagery.</p>
              </Surface>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <Badge>Week 4</Badge>
            <Badge tone="accent">On track</Badge>
            <Badge tone="achievement">Milestone</Badge>
            <Badge tone="caution">Offline</Badge>
            <Badge tone="danger">Couldn’t save</Badge>
          </div>
        </Block>

        <Block id="overlays" title="Dialog and sheet">
          <div className="flex flex-wrap gap-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary">Open dialog</Button>
              </DialogTrigger>
              <DialogContent
                title="Reset this goal?"
                description="Your journey and progress will be archived. You can start a new goal right after."
                footer={
                  <>
                    <DialogClose asChild>
                      <Button variant="quiet">Keep my goal</Button>
                    </DialogClose>
                    <Button variant="danger">Reset goal</Button>
                  </>
                }
              >
                <p className="text-small text-text-secondary">Below 768px this opens as a bottom sheet.</p>
              </DialogContent>
            </Dialog>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary">Open sheet</Button>
              </DialogTrigger>
              <SheetContent title="Today’s session" description="Thumbnail framing and a 30-second hook.">
                <div className="flex flex-col gap-4">
                  {Array.from({ length: 8 }, (_, index) => (
                    <p key={index} className="text-body text-text-secondary">
                      Step {index + 1}. Long content scrolls inside the sheet while the page stays locked.
                    </p>
                  ))}
                </div>
              </SheetContent>
            </Dialog>
          </div>
        </Block>

        <Block id="tabs" title="Tabs">
          <Tabs defaultValue="today">
            <TabsList aria-label="Session detail">
              <TabsTrigger value="today">Today</TabsTrigger>
              <TabsTrigger value="why">Why it matters</TabsTrigger>
              <TabsTrigger value="short">Short version</TabsTrigger>
              <TabsTrigger value="later" disabled>
                Later
              </TabsTrigger>
            </TabsList>
            <TabsContent value="today">
              <p className="text-body text-text-secondary">Draft three title and thumbnail pairs.</p>
            </TabsContent>
            <TabsContent value="why">
              <p className="text-body text-text-secondary">The first 30 seconds decide whether anyone stays.</p>
            </TabsContent>
            <TabsContent value="short">
              <p className="text-body text-text-secondary">Write one hook and read it aloud. 10 minutes.</p>
            </TabsContent>
          </Tabs>
        </Block>

        <Block id="progress" title="Progress">
          <div className="flex flex-col gap-8">
            <ProgressBar label="Journey" value={27} max={90} valueText="27 of 90 days" showValue />
            <ProgressBar label="This week" value={3} max={5} valueText="3 of 5 sessions" showValue />
            <ProgressBar label="Phase 1 milestone" value={3} max={4} tone="achievement" showValue valueText="3 of 4 weeks" />
            <ul className="flex flex-wrap items-center gap-8">
              {markers.map((state) => (
                <li key={state} className="flex items-center gap-3">
                  <StepMarker state={state} size="lg" />
                  <span className="font-ui-mono text-micro uppercase text-text-secondary">{state}</span>
                </li>
              ))}
            </ul>
            <ol className="flex items-center gap-2" aria-label="Week 4">
              {(['completed', 'completed', 'completed', 'active', 'upcoming', 'upcoming', 'milestone'] as StepState[]).map((state, index) => (
                <li key={index} className="flex items-center gap-2">
                  <StepMarker state={state} label={`Day ${index + 22}, ${state}`} />
                  {index < 6 && <span aria-hidden="true" className="h-px w-6 bg-border-strong" />}
                </li>
              ))}
            </ol>
          </div>
        </Block>

        <Block id="states" title="States">
          <div className="grid gap-4 sm:grid-cols-2">
            <EmptyState
              icon={<Compass aria-hidden="true" strokeWidth={1.25} className="size-8" />}
              title="No reviews yet"
              description="Your first weekly review opens at the end of week 1."
              action={<Button variant="secondary" size="sm">See the journey</Button>}
            />
            <Surface>
              <LoadingState label="Loading your journey" showLabel />
            </Surface>
            <ErrorState
              className="sm:col-span-2"
              title="We couldn’t load today’s step"
              description="Check your connection. Your progress is safe."
              onRetry={retry}
              retrying={retrying}
            />
          </div>
        </Block>
      </main>
    </div>
  );
};

export default UiPreviewPage;
