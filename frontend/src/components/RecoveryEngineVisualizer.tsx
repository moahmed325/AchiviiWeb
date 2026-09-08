import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';

interface EngineModule {
  id: 'module-1' | 'module-2' | 'module-3';
  index: string;
  tier: string;
  title: string;
  subtitle: string;
  triggerCondition: string;
  mechanism: string[];
  telemetryMetrics: { label: string; value: string }[];
  statusIndicator: string;
}

const MODULES: EngineModule[] = [
  {
    id: 'module-1',
    index: '01',
    tier: 'TIER 1 PROTOCOL',
    title: 'Buffer Slot Injection',
    subtitle: 'Silent Within-Week Reallocation',
    triggerCondition: 'Single session missed or calendar scheduling conflict detected',
    mechanism: [
      'Automatically checks downstream availability slots for non-conflicting free time.',
      'Injects missed session into designated weekly buffer slots (including Sunday recovery).',
      'Zero manual friction: schedule adjusts silently with 0-day project slippage.'
    ],
    telemetryMetrics: [
      { label: 'RECOVERY LATENCY', value: '< 50MS' },
      { label: 'TIMELINE DRIFT', value: '0 DAYS' },
      { label: 'CORE RETENTION', value: '100%' }
    ],
    statusIndicator: 'NOMINAL RECOVERY'
  },
  {
    id: 'module-2',
    index: '02',
    tier: 'TIER 2 PROTOCOL',
    title: 'Adaptive Shift & Shrink',
    subtitle: 'Inline Non-Blocking Triage',
    triggerCondition: '2+ consecutive missed sessions or within-week buffer slots exhausted',
    mechanism: [
      'Renders non-blocking inline triage directly on the rolling calendar agenda.',
      'Presents two deterministic recovery pathways: "Shrink Week" or "Shift Timeline".',
      'Protects core habit sessions while safely pruning low-priority buffer blocks.'
    ],
    telemetryMetrics: [
      { label: 'TRIGGER THRESHOLD', value: '>= 2 MISSES' },
      { label: 'INTERACTION', value: 'NON-BLOCKING' },
      { label: 'TIMELINE SHIFT', value: '+7 DAYS' }
    ],
    statusIndicator: 'ADAPTIVE TRIAGE'
  },
  {
    id: 'module-3',
    index: '03',
    tier: 'TIER 3 PROTOCOL',
    title: 'Circuit Breaker Guardrail',
    subtitle: 'Burnout & Fatigue Interlock',
    triggerCondition: 'Slippage >= 14 days OR 4+ recovery events accumulated within 28 days',
    mechanism: [
      'Hard guardrail intervenes to prevent the fatal shame/abandonment cycle.',
      'Presents strategic adaptations: "Scope Reduction" (decrease sessions/wk) or "Goal Pause".',
      'Safely freezes all progression telemetry with zero data or historical streak loss.'
    ],
    telemetryMetrics: [
      { label: 'GUARDRAIL LIMIT', value: '>= 14 DAYS' },
      { label: 'ROLLING WINDOW', value: '28 DAYS' },
      { label: 'FAIL-SAFE', value: 'PRESERVED' }
    ],
    statusIndicator: 'INTERLOCK ENGAGED'
  }
];

export const RecoveryEngineVisualizer: React.FC = () => {
  const [activeModuleId, setActiveModuleId] = useState<'module-1' | 'module-2' | 'module-3'>('module-1');
  const activeModule = MODULES.find((m) => m.id === activeModuleId) || MODULES[0];

  return (
    <section className="space-y-6">
      {/* Section Header Micro-Label */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#182621] pb-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#07CB6C]">
            SYSTEM ARCHITECTURE // RECOVERY ENGINE SCHEMATIC
          </span>
        </div>
        <span className="text-[10px] font-mono text-[#55675c]">
          3-TIER DETERMINISTIC RESILIENCE SPEC
        </span>
      </div>

      {/* 3-Module Architectural Grid */}
      <div className="flex flex-col md:grid md:grid-cols-3 gap-4">
        {MODULES.map((mod) => {
          const isSelected = mod.id === activeModuleId;
          return (
            <div
              key={mod.id}
              onClick={() => setActiveModuleId(mod.id)}
              className={`min-h-[44px] p-5 rounded-md bg-[#0c1210] border transition-colors cursor-pointer flex flex-col justify-between space-y-4 shadow-none ${
                isSelected
                  ? 'border-[#07CB6C] ring-1 ring-[#07CB6C]/20'
                  : 'border-[#182621] hover:border-[#2a443a]'
              }`}
            >
              <div className="space-y-3">
                {/* Module Number & Tier Chip */}
                <div className="flex items-center justify-between">
                  <span className="text-xl font-mono font-extrabold text-[#07CB6C]">
                    {mod.index}
                  </span>
                  <span className={`px-2 py-0.5 rounded-sm text-[9px] font-mono font-bold tracking-wider uppercase border ${
                    isSelected
                      ? 'bg-[#07CB6C]/10 text-[#07CB6C] border-[#07CB6C]/30'
                      : 'bg-[#080d0b] text-[#7e8f85] border-[#182621]'
                  }`}>
                    {mod.tier}
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="text-base font-bold text-[#e5ebe7]">
                    {mod.title}
                  </h3>
                  <p className="text-xs font-mono text-[#7e8f85]">
                    {mod.subtitle}
                  </p>
                </div>

                <div className="p-2.5 rounded-sm bg-[#080d0b] border border-[#182621] space-y-1 text-[11px] font-mono text-[#a6b8ad]">
                  <span className="text-[9px] text-[#55675c] block uppercase">TRIGGER CONDITION</span>
                  <p className="text-[#a6b8ad] leading-relaxed">{mod.triggerCondition}</p>
                </div>
              </div>

              {/* Module Action Footer */}
              <div className="pt-2 border-t border-[#182621] flex items-center justify-between text-xs font-mono">
                <span className={`text-[10px] font-bold ${isSelected ? 'text-[#07CB6C]' : 'text-[#7e8f85]'}`}>
                  [{isSelected ? 'ACTIVE MODULE' : 'INSPECT SPEC'}]
                </span>
                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isSelected ? 'text-[#07CB6C] rotate-90 sm:rotate-0' : 'text-[#55675c]'}`} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Module Deep-Dive Telemetry Console */}
      <div className="p-5 sm:p-6 rounded-md bg-[#0c1210] border border-[#182621] space-y-5 shadow-none">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#182621] pb-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#07CB6C]">
                CONSOLE TELEMETRY // MODULE {activeModule.index}: {activeModule.tier}
              </span>
              <span className="px-1.5 py-0.2 rounded-sm bg-[#07CB6C]/10 border border-[#07CB6C]/30 text-[9px] font-mono text-[#07CB6C]">
                {activeModule.statusIndicator}
              </span>
            </div>
            <h4 className="text-base sm:text-lg font-bold text-[#e5ebe7] truncate">
              {activeModule.title} — Technical Mechanics
            </h4>
          </div>

          {/* Real-time Telemetry Metrics Chips */}
          <div className="flex flex-wrap items-center gap-2">
            {activeModule.telemetryMetrics.map((met, i) => (
              <div key={i} className="px-3 py-1.5 rounded-sm bg-[#080d0b] border border-[#182621] font-mono text-xs">
                <span className="text-[9px] text-[#55675c] block">{met.label}</span>
                <span className="text-xs font-bold text-[#e5ebe7]">{met.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Mechanism Execution Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {activeModule.mechanism.map((step, sIdx) => (
            <div
              key={sIdx}
              className="p-3.5 rounded-sm bg-[#080d0b] border border-[#182621] space-y-1.5 text-xs font-mono"
            >
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-sm bg-[#16221e] border border-[#1f332c] text-[#07CB6C] text-[10px] font-bold flex items-center justify-center">
                  0{sIdx + 1}
                </span>
                <span className="text-[10px] uppercase text-[#7e8f85] font-bold tracking-wider">
                  EXECUTION STEP
                </span>
              </div>
              <p className="text-[#a6b8ad] leading-relaxed pt-1">
                {step}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
