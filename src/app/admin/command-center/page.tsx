'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamic imports to avoid SSR issues with these heavy components
const GoogleSEOPanel = dynamic(() => import('@/components/command-center/GoogleSEOPanel'), { ssr: false, loading: () => <PanelLoader label="Google & SEO" /> });
const SocialMediaPanel = dynamic(() => import('@/components/command-center/SocialMediaPanel'), { ssr: false, loading: () => <PanelLoader label="Social Media" /> });
const CampaignsPanel = dynamic(() => import('@/app/admin/campaigns/page'), { ssr: false, loading: () => <PanelLoader label="Campaigns" /> });

function PanelLoader({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '400px', color: '#71717a', fontSize: 14 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 24, marginBottom: 8, animation: 'spin 1s linear infinite' }}>⏳</div>
        <div>Loading {label}...</div>
      </div>
    </div>
  );
}

type PanelId = 'campaigns' | 'command' | 'social';

export default function CommandCenterPage() {
  const [expandedPanel, setExpandedPanel] = useState<PanelId | null>(null);
  const [collapsedPanels, setCollapsedPanels] = useState<Set<PanelId>>(new Set());

  const toggleCollapse = (id: PanelId) => {
    setCollapsedPanels(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 2) next.add(id); // Don't allow collapsing all 3
      return next;
    });
    setExpandedPanel(null);
  };

  const toggleExpand = (id: PanelId) => {
    setExpandedPanel(prev => prev === id ? null : id);
    setCollapsedPanels(new Set());
  };

  const getPanelWidth = (id: PanelId): string => {
    if (expandedPanel === id) return '100%';
    if (expandedPanel) return '0px';
    if (collapsedPanels.has(id)) return '48px';
    // Distribute remaining space among non-collapsed panels
    const openCount = 3 - collapsedPanels.size;
    if (openCount === 3) return '33.333%';
    if (openCount === 2) return 'calc((100% - 48px) / 2)';
    return 'calc(100% - 96px)';
  };

  const panels: { id: PanelId; label: string; icon: string; color: string; component: React.ReactNode }[] = [
    { id: 'campaigns', label: 'Campaigns', icon: '📣', color: '#2dd4bf', component: <CampaignsPanel /> },
    { id: 'command', label: 'Marketing Command Center', icon: '🎯', color: '#a855f7', component: <MarketingCommandCenter /> },
    { id: 'social', label: 'Social Media', icon: '📱', color: '#ec4899', component: <SocialMediaPanel /> },
  ];

  return (
    <>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .cmd-panel { transition: width 0.3s ease, min-width 0.3s ease, opacity 0.3s ease; overflow: hidden; }
        .cmd-panel-inner { height: calc(100vh - 56px); overflow-y: auto; overflow-x: hidden; }
        .cmd-panel-inner::-webkit-scrollbar { width: 4px; }
        .cmd-panel-inner::-webkit-scrollbar-track { background: transparent; }
        .cmd-panel-inner::-webkit-scrollbar-thumb { background: #27272a; border-radius: 4px; }
        .cmd-panel-inner::-webkit-scrollbar-thumb:hover { background: #a855f7; }
        .cmd-collapsed-label { writing-mode: vertical-rl; text-orientation: mixed; transform: rotate(180deg); }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#fff', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
        {/* Top bar */}
        <div style={{
          height: 56, borderBottom: '1px solid #1a1a24', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: '0 16px', background: '#0d0d12',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <a href="/admin/doctors/dashboard" style={{ color: '#71717a', fontSize: 12, textDecoration: 'none' }}>← Admin</a>
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, background: 'linear-gradient(135deg, #06b6d4, #a855f7, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Command Center
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {panels.map(p => (
              <button
                key={p.id}
                onClick={() => toggleExpand(p.id)}
                style={{
                  padding: '4px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  border: expandedPanel === p.id ? `1px solid ${p.color}` : '1px solid #27272a',
                  background: expandedPanel === p.id ? `${p.color}20` : '#12121a',
                  color: expandedPanel === p.id ? p.color : '#71717a',
                }}
              >
                {p.icon} {expandedPanel === p.id ? 'Collapse' : p.label}
              </button>
            ))}
          </div>
        </div>

        {/* 3-panel layout */}
        <div style={{ display: 'flex', height: 'calc(100vh - 56px)', overflow: 'hidden' }}>
          {panels.map((p, i) => {
            const isCollapsed = collapsedPanels.has(p.id);
            const isExpanded = expandedPanel === p.id;
            const isHidden = expandedPanel !== null && !isExpanded;

            return (
              <div
                key={p.id}
                className="cmd-panel"
                style={{
                  width: getPanelWidth(p.id),
                  minWidth: isHidden ? 0 : isCollapsed ? 48 : 300,
                  borderRight: i < 2 ? '1px solid #1a1a24' : 'none',
                  display: isHidden ? 'none' : 'flex',
                  flexDirection: 'column',
                  opacity: isHidden ? 0 : 1,
                }}
              >
                {/* Panel header */}
                <div style={{
                  height: 36, minHeight: 36, borderBottom: '1px solid #1a1a24',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: isCollapsed ? '0 4px' : '0 12px', background: '#0d0d12',
                  cursor: 'pointer',
                }} onClick={() => isCollapsed ? toggleCollapse(p.id) : undefined}>
                  {isCollapsed ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', padding: '8px 0' }}>
                      <span style={{ fontSize: 16 }}>{p.icon}</span>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 14 }}>{p.icon}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: p.color, letterSpacing: 0.5, textTransform: 'uppercase' }}>{p.label}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleCollapse(p.id); }}
                          style={{ width: 20, height: 20, borderRadius: 4, border: '1px solid #27272a', background: 'transparent', color: '#71717a', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          title="Collapse"
                        >
                          ─
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleExpand(p.id); }}
                          style={{ width: 20, height: 20, borderRadius: 4, border: '1px solid #27272a', background: 'transparent', color: '#71717a', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          title="Expand"
                        >
                          ⤢
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Panel content — each scrolls independently */}
                {!isCollapsed && (
                  <div className="cmd-panel-inner" style={{ flex: 1 }}>
                    <div style={{ transform: 'scale(1)', transformOrigin: 'top left', width: '100%' }}>
                      {p.component}
                    </div>
                  </div>
                )}

                {/* Collapsed vertical label */}
                {isCollapsed && (
                  <div
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    onClick={() => toggleCollapse(p.id)}
                  >
                    <span className="cmd-collapsed-label" style={{ fontSize: 11, fontWeight: 600, color: p.color, letterSpacing: 1 }}>
                      {p.label}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// MARKETING COMMAND CENTER — Center Panel (Placeholder)
// This is where the AI Ad Designer, Rotation Engine, AI Agent,
// Leads Manager, Stripe Integration will live
// ═══════════════════════════════════════════════════════════════
function MarketingCommandCenter() {
  const brands = [
    { id: 'streamsai', name: 'StreamsAI', icon: '🤖', color: '#6366f1', phone: 'Not configured' },
    { id: 'evenbetterbuy', name: 'EvenBetterBuy', icon: '🛒', color: '#f59e0b', phone: 'Not configured' },
    { id: 'xtremenad', name: 'XtremeNad', icon: '💪', color: '#ef4444', phone: 'Not configured' },
    { id: 'medazonhealth', name: 'MedazonHealth', icon: '🏥', color: '#2dd4bf', phone: 'Not configured' },
  ];

  const sections = [
    { icon: '🎨', title: 'AI Ad Designer', desc: 'DALL·E 3 image gen + Claude copy gen', status: 'Coming Soon' },
    { icon: '🔄', title: 'Lead Rotation Engine', desc: '4 numbers × 1 lead pool × smart rotation', status: 'Coming Soon' },
    { icon: '🤖', title: 'AI Marketing Agent', desc: 'Chat-based strategy + content generation', status: 'Coming Soon' },
    { icon: '👥', title: 'Leads & Data Sources', desc: 'CSV upload, Medazon patients, API endpoint', status: 'Coming Soon' },
    { icon: '💳', title: 'Stripe Checkouts', desc: 'Per-niche checkout pages + conversion tracking', status: 'Coming Soon' },
    { icon: '🔑', title: 'API Keys', desc: 'ClickSend, Twilio, OpenAI, Stripe — all from UI', status: 'Coming Soon' },
    { icon: '📊', title: 'Analytics', desc: 'Per-niche: sent, delivered, replied, converted', status: 'Coming Soon' },
    { icon: '⚡', title: 'Automation', desc: 'Daily cron, smart scheduling, auto-pause', status: 'Coming Soon' },
  ];

  return (
    <div style={{ padding: 20, minHeight: '100%', background: '#0a0a0f' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🎯</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px', background: 'linear-gradient(135deg, #a855f7, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Marketing Command Center
        </h2>
        <p style={{ fontSize: 12, color: '#71717a', margin: 0 }}>4-Brand SMS/MMS Rotation Engine + AI Ad Designer</p>
      </div>

      {/* Brand Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
        {brands.map(b => (
          <div key={b.id} style={{
            padding: 12, borderRadius: 12, border: '1px solid #1a1a24', background: '#12121a',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 20 }}>{b.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{b.name}</div>
              <div style={{ fontSize: 10, color: '#52525b' }}>{b.phone}</div>
            </div>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#52525b' }} title="Not configured" />
          </div>
        ))}
      </div>

      {/* Feature Sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sections.map((s, i) => (
          <div key={i} style={{
            padding: '12px 14px', borderRadius: 10, border: '1px solid #1a1a24', background: '#12121a',
            display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
            transition: 'border-color 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#a855f740')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = '#1a1a24')}
          >
            <span style={{ fontSize: 20, width: 32, textAlign: 'center' }}>{s.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{s.title}</div>
              <div style={{ fontSize: 10, color: '#71717a' }}>{s.desc}</div>
            </div>
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
              background: '#a855f715', color: '#a855f7', border: '1px solid #a855f730',
              letterSpacing: 0.5,
            }}>{s.status}</span>
          </div>
        ))}
      </div>

      {/* AI Agent Preview */}
      <div style={{
        marginTop: 20, padding: 16, borderRadius: 12, border: '1px solid #a855f730',
        background: 'linear-gradient(135deg, #a855f708, #ec489908)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 16 }}>🤖</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#a855f7' }}>AI Marketing Agent</span>
        </div>
        <div style={{
          padding: '10px 14px', borderRadius: 8, background: '#0d0d12', border: '1px solid #1a1a24',
          fontSize: 12, color: '#52525b', fontStyle: 'italic',
        }}>
          "What should I send this week?" — Coming soon...
        </div>
      </div>
    </div>
  );
}
