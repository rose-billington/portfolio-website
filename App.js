import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  Platform, Dimensions,
} from 'react-native';
import { useRef, useCallback, useState, useEffect } from 'react';
import ParticleWave from './ParticleWave';
import { WireFlow, WireFlowFill, WireSphere, WireTerrain, WireBox, WireTorus, WireCylinder, WireDNA } from './WireframeDecor';

// ── Sections ──────────────────────────────────────────────────────────────────
const SECTIONS = [
  { name:'Red',    icon:'flame-outline',   sub:'Section one — your intro or hero content.' },
  { name:'Orange', icon:'sunny-outline',   sub:'Section two — about you or your story.'    },
  { name:'Yellow', icon:'star-outline',    sub:'Section three — skills and expertise.'     },
  { name:'Green',  icon:'leaf-outline',    sub:'Section four — projects and work.'         },
  { name:'Blue',   icon:'water-outline',   sub:'Section five — experience and timeline.'  },
  { name:'Purple', icon:'planet-outline',  sub:'Section six — contact and closing.'       },
];

const SCREEN_H = Dimensions.get('window').height;
const IS_WEB   = Platform.OS === 'web';
const BUNGEE   = IS_WEB ? "'Bungee Hairline', sans-serif" : undefined;
const RUBIK    = IS_WEB ? "'Rubik Mono One', sans-serif"  : undefined;

// ── Nav tabs config ───────────────────────────────────────────────────────────
const NAV_TABS = [
  { id:'discover',  label:'DISCOVER',        discover: true },
  { id:'skills',    label:'SKILL SUMMARY'                   },
  { id:'fav',       label:'FAVOURITE PROJECTS'              },
  { id:'recent',    label:'RECENT PROJECTS'                 },
  { id:'contact',   label:'CONTACT'                         },
];

// ── Top navigation bar ────────────────────────────────────────────────────────
function TopBar({ activeTab, onTab }) {
  return (
    <View style={n.bar}>
      {/* left — wordmark */}
      <View style={n.wordmark}>
        <Text style={n.wordmarkInitials}>RB</Text>
        <View style={n.wordmarkDivider} />
        <Text style={n.wordmarkFull}>ROSE BILLINGTON</Text>
      </View>

      {/* right — tabs */}
      <View style={n.tabs}>
        {NAV_TABS.map((tab) => {
          const active = activeTab === tab.id;
          return tab.discover ? (
            <TouchableOpacity
              key={tab.id}
              style={[n.discoverBtn, active && n.discoverBtnActive]}
              onPress={() => onTab(tab.id)}
              activeOpacity={0.8}
            >
              <Text style={[n.discoverTxt, active && n.discoverTxtActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              key={tab.id}
              style={n.tab}
              onPress={() => onTab(tab.id)}
              activeOpacity={0.7}
            >
              <Text style={[n.tabTxt, active && n.tabTxtActive]}>{tab.label}</Text>
              {active && <View style={n.tabUnderline} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ── Segmented skill bar ───────────────────────────────────────────────────────
function SkillBar({ label, value, max = 5 }) {
  const SEGS = 13;
  const filled = Math.round((value / max) * SEGS);
  return (
    <View style={sk.row}>
      <Text style={sk.label}>{label}</Text>
      <View style={sk.track}>
        {Array.from({ length: SEGS }).map((_, i) => (
          <View key={i} style={[sk.seg, i < filled && sk.segOn]} />
        ))}
      </View>
    </View>
  );
}

// ── Shared style helpers (used by HUD overlay and panels) ────────────────────
const CLIP = (cut) =>
  IS_WEB
    ? { clipPath: `polygon(0 0,calc(100% - ${cut}px) 0,100% ${cut}px,100% 100%,${cut}px 100%,0 calc(100% - ${cut}px))` }
    : {};
const _lowEnd = IS_WEB && ((navigator.hardwareConcurrency || 4) <= 4 || (navigator.deviceMemory || 4) <= 4);
const BLUR = IS_WEB && !_lowEnd ? { backdropFilter:'blur(6px)', WebkitBackdropFilter:'blur(6px)' } : {};

// ── HUD overlay atoms ─────────────────────────────────────────────────────────
const LINE_COL = 'rgba(255,255,255,0.22)';
const BOX_BG   = { backgroundColor:'rgba(0,0,0,0.78)', ...BLUR };

function HudDot({ style, size = 5, filled = false }) {
  return (
    <View style={[{
      position:'absolute', width:size, height:size, borderRadius:size/2,
      borderWidth:1, borderColor:'rgba(255,255,255,0.55)',
      backgroundColor: filled ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)',
    }, style]} />
  );
}
function HudLine({ style }) {
  return <View style={[{ position:'absolute', backgroundColor:LINE_COL }, style]} />;
}
function HudCallout({ title, lines = [], style, w = 148 }) {
  return (
    <View style={[{ position:'absolute', width:w, borderWidth:1, borderColor:'rgba(255,255,255,0.22)', padding:8 }, BOX_BG, CLIP(5), style]}>
      {title && (
        <View style={{ borderBottomWidth:1, borderBottomColor:'rgba(255,255,255,0.1)', paddingBottom:4, marginBottom:5 }}>
          <Text style={{ fontFamily:BUNGEE, fontSize:8, letterSpacing:3, color:'rgba(255,255,255,0.85)', textTransform:'uppercase' }}>{title}</Text>
        </View>
      )}
      {lines.map((l, i) => (
        <Text key={i} style={{ fontFamily:BUNGEE, fontSize:7, letterSpacing:1.5, color:'rgba(255,255,255,0.38)', lineHeight:13, textTransform:'uppercase' }}>{l}</Text>
      ))}
    </View>
  );
}
function SignalWave() {
  const h = [3,7,4,11,6,14,8,12,5,10,7,15,4,9,6,11,8,13,5,9];
  return (
    <View style={{ flexDirection:'row', alignItems:'flex-end', gap:1.5, height:18 }}>
      {h.map((v, i) => <View key={i} style={{ width:3, height:v, backgroundColor:`rgba(255,255,255,${0.25+(v/15)*0.45})` }} />)}
    </View>
  );
}
function MiniBarChart() {
  const b = [8,14,6,18,10,16,12,20,8,15];
  return (
    <View style={{ flexDirection:'row', alignItems:'flex-end', gap:2, height:22 }}>
      {b.map((v, i) => <View key={i} style={{ width:5, height:(v/20)*22, backgroundColor:'rgba(255,255,255,0.5)' }} />)}
    </View>
  );
}
function TargetX({ style }) {
  return (
    <View style={[{ position:'absolute', width:18, height:18 }, style]}>
      <View style={{ position:'absolute', top:8, left:0, right:0, height:1, backgroundColor:'rgba(255,255,255,0.35)' }} />
      <View style={{ position:'absolute', left:8, top:0, bottom:0, width:1,  backgroundColor:'rgba(255,255,255,0.35)' }} />
      <View style={{ position:'absolute', top:6, left:6, width:6, height:6, borderRadius:3, borderWidth:1, borderColor:'rgba(255,255,255,0.5)' }} />
    </View>
  );
}

// ── Hero foreground overlay (renders ON TOP of panels) ────────────────────────
function HeroOverlay() {
  if (!IS_WEB) return null;
  return (
    <View style={[StyleSheet.absoluteFill, { overflow:'hidden' }]} pointerEvents="none">

      {/* ── TOP-LEFT: file path callout ── */}
      <HudDot style={{ top:76, left:28 }} />
      <HudLine style={{ top:78, left:33, width:54, height:1 }} />
      <HudLine style={{ top:78, left:86, width:1, height:28 }} />
      <HudCallout title="F:\PORTFOLIO\ROSE" lines={['STATUS: ACTIVE','BUILD: 2025','MODE: DISPLAY']}
        style={{ top:106, left:58 }} w={162} />

      {/* ── TOP-CENTER: analysis bar chart ── */}
      <View style={{ position:'absolute', top:70, left:'38%', alignItems:'center', gap:4 }}>
        <Text style={{ fontFamily:BUNGEE, fontSize:7, letterSpacing:3, color:'rgba(255,255,255,0.4)', textTransform:'uppercase' }}>ANALYSIS</Text>
        <MiniBarChart />
      </View>

      {/* ── TOP-RIGHT: database callout ── */}
      <HudDot style={{ top:76, right:210 }} />
      <HudLine style={{ top:78, right:165, width:44, height:1 }} />
      <HudCallout title="DATA BASE" lines={['PROJECTS:  24+','CLIENTS:   12+','INDEX: 0xRB25','CANCEL: ■■■■']}
        style={{ top:68, right:8 }} w={155} />

      {/* ── MID-LEFT: description callout overlapping left panel ── */}
      <HudLine style={{ top:'26%', left:8, width:1, height:24 }} />
      <HudLine style={{ top:'26%', left:8, width:28, height:1 }} />
      <HudCallout title="DESCRIPTION" lines={['GRAPHIC + WEB DESIGN','4 YEARS ACTIVE','MASSACHUSETTS  US','18.04.2025']}
        style={{ top:'28%', left:8 }} w={162} />

      {/* ── MID-LEFT: analysis/engineering labels ── */}
      <View style={{ position:'absolute', top:'47%', left:'12%' }}>
        <Text style={{ fontFamily:BUNGEE, fontSize:9, letterSpacing:3, color:'rgba(255,255,255,0.5)', textTransform:'uppercase' }}>ANALYSIS</Text>
        <Text style={{ fontFamily:BUNGEE, fontSize:9, letterSpacing:3, color:'rgba(255,255,255,0.32)', textTransform:'uppercase', marginTop:2 }}>ENGINEERING</Text>
        {['PASTE  +  CHARGE','PASTE  +  CHOSE'].map((t, i) => (
          <View key={i} style={{ flexDirection:'row', alignItems:'center', gap:5, marginTop:4 }}>
            <View style={{ width:3, height:3, backgroundColor:'rgba(255,255,255,0.4)' }} />
            <Text style={{ fontFamily:BUNGEE, fontSize:7, letterSpacing:1, color:'rgba(255,255,255,0.28)', textTransform:'uppercase' }}>{t}</Text>
          </View>
        ))}
      </View>

      {/* ── MID-LEFT: triangle warning ── */}
      <Text style={{ position:'absolute', top:'44%', left:18, fontFamily:BUNGEE, fontSize:16, color:'rgba(255,255,255,0.3)' }}>▲</Text>

      {/* ── TARGET crosshairs scattered ── */}
      <TargetX style={{ top:'30%', left:'28%' }} />
      <TargetX style={{ top:'22%', left:'66%' }} />

      {/* ── RIGHT: percentage badge (overlaps sphere panel) ── */}
      <View style={[{ position:'absolute', top:'52%', right:8, borderWidth:1, borderColor:'rgba(255,255,255,0.3)', padding:10, alignItems:'center' }, BOX_BG, CLIP(8)]}>
        <Text style={{ fontFamily:RUBIK, fontSize:22, color:'#fff', letterSpacing:2 }}>78%</Text>
        <Text style={{ fontFamily:BUNGEE, fontSize:7, letterSpacing:2, color:'rgba(255,255,255,0.4)', textTransform:'uppercase' }}>CAPACITY</Text>
      </View>

      {/* ── BOTTOM-LEFT: PIN callout ── */}
      <HudDot style={{ top:'63%', left:46 }} size={7} filled />
      <HudLine style={{ top:'63%', left:52, width:36, height:1 }} />
      <View style={[{ position:'absolute', top:'63%', left:88, borderWidth:1, borderColor:'rgba(255,255,255,0.22)', paddingHorizontal:8, paddingVertical:3 }, BOX_BG, CLIP(4)]}>
        <Text style={{ fontFamily:BUNGEE, fontSize:8, letterSpacing:3, color:'rgba(255,255,255,0.7)', textTransform:'uppercase' }}>PIN  RB-25</Text>
      </View>

      {/* ── BOTTOM-LEFT: properties numbered list (overlaps bio panel) ── */}
      <View style={[{ position:'absolute', top:'70%', left:8, borderWidth:1, borderColor:'rgba(255,255,255,0.18)', padding:10, width:148 }, BOX_BG, CLIP(6)]}>
        <Text style={{ fontFamily:BUNGEE, fontSize:8, letterSpacing:3, color:'rgba(255,255,255,0.75)', textTransform:'uppercase', borderBottomWidth:1, borderBottomColor:'rgba(255,255,255,0.1)', paddingBottom:5, marginBottom:7 }}>PROPERTIES</Text>
        {['BRANDING','WEB DESIGN','UI / UX'].map((item, i) => (
          <View key={i} style={{ flexDirection:'row', alignItems:'center', gap:6, marginBottom:5 }}>
            <View style={{ width:14, height:14, borderWidth:1, borderColor:'rgba(255,255,255,0.28)', alignItems:'center', justifyContent:'center' }}>
              <Text style={{ fontFamily:BUNGEE, fontSize:7, color:'rgba(255,255,255,0.55)' }}>{i+1}</Text>
            </View>
            <Text style={{ fontFamily:BUNGEE, fontSize:7, letterSpacing:2, color:'rgba(255,255,255,0.38)', textTransform:'uppercase' }}>{item}</Text>
          </View>
        ))}
      </View>

      {/* ── BOTTOM-CENTER: vertical data labels ── */}
      <View style={{ position:'absolute', top:'66%', left:'30%', gap:6 }}>
        {['CAPACITY','RESISTANCE','VOLTAGE','CURRENT'].map((t, i) => (
          <View key={i} style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
            <View style={{ width:8, height:1, backgroundColor:LINE_COL }} />
            <Text style={{ fontFamily:BUNGEE, fontSize:8, letterSpacing:2, color:'rgba(255,255,255,0.35)', textTransform:'uppercase' }}>{t}</Text>
          </View>
        ))}
      </View>

      {/* ── BOTTOM-CENTER: signal waveform box (overlaps flow panel) ── */}
      <View style={[{ position:'absolute', top:'67%', left:'44%', borderWidth:1, borderColor:'rgba(255,255,255,0.2)', padding:10, gap:6 }, BOX_BG, CLIP(6)]}>
        <Text style={{ fontFamily:BUNGEE, fontSize:7, letterSpacing:2, color:'rgba(255,255,255,0.5)', textTransform:'uppercase' }}>AUDIO SIGNAL  ·  00:13</Text>
        <SignalWave />
        <Text style={{ fontFamily:BUNGEE, fontSize:6.5, letterSpacing:1.5, color:'rgba(255,255,255,0.28)', textTransform:'uppercase' }}>▶  INCOMING  VIDEO  SIGNAL</Text>
      </View>

      {/* ── BOTTOM-RIGHT: system test box ── */}
      <HudCallout title="SYSTEM TEST" lines={['RENDER: PASS  ✓','SIGNAL: ONLINE','NET:    ACTIVE','00:24  ·  SYS-RB']}
        style={{ bottom:'18%', right:8 }} w={158} />

      {/* ── RIGHT-BOTTOM: CYBER labels ── */}
      <View style={{ position:'absolute', bottom:'10%', right:8, gap:4, alignItems:'flex-end' }}>
        {['CYBER','CYBER','CYBER'].map((t, i) => (
          <View key={i} style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
            <View style={{ width:20, height:1, backgroundColor:LINE_COL }} />
            <View style={{ borderWidth:1, borderColor:'rgba(255,255,255,0.2)', paddingHorizontal:6, paddingVertical:2 }}>
              <Text style={{ fontFamily:BUNGEE, fontSize:7, letterSpacing:2, color:'rgba(255,255,255,0.32)', textTransform:'uppercase' }}>{t}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* ── CONNECTOR LINES ── */}
      {/* left spine */}
      <HudLine style={{ top:'32%', left:170, width:1, height:'12%' }} />
      {/* right connectors */}
      <HudLine style={{ top:'22%', right:163, width:28, height:1 }} />
      <HudLine style={{ top:'22%', right:163, width:1, height:50 }} />
      {/* bottom-center cross-bar */}
      <HudLine style={{ top:'64%', left:'29%', width:'14%', height:1 }} />
    </View>
  );
}

// ── HUD computer window ───────────────────────────────────────────────────────
function HudWindow({ title, sub, children, style, cut = 10 }) {
  return (
    <View style={[hw.win, CLIP(cut), style]}>
      {/* title bar */}
      <View style={hw.bar}>
        <Text style={hw.barTitle}>{title}</Text>
        <View style={hw.barDots}>
          <View style={hw.dot} />
          <View style={hw.dot} />
          <View style={hw.dot} />
        </View>
      </View>
      {/* content */}
      <View style={hw.body}>{children}</View>
      {/* footer */}
      {sub && (
        <View style={hw.foot}>
          <View style={hw.footPulse} />
          <Text style={hw.footText}>{sub}</Text>
        </View>
      )}
    </View>
  );
}

// ── Corner bracket decoration ─────────────────────────────────────────────────
function Brackets({ size = 16, color = 'rgba(255,255,255,0.35)', style: extra }) {
  const b = { position:'absolute', width:size, height:size, borderColor:color };
  return (
    <View style={[{ position:'absolute', inset:0, pointerEvents:'none' }, extra]}>
      <View style={[b, { top:0,    left:0,  borderTopWidth:1,    borderLeftWidth:1  }]} />
      <View style={[b, { top:0,    right:0, borderTopWidth:1,    borderRightWidth:1 }]} />
      <View style={[b, { bottom:0, left:0,  borderBottomWidth:1, borderLeftWidth:1  }]} />
      <View style={[b, { bottom:0, right:0, borderBottomWidth:1, borderRightWidth:1 }]} />
    </View>
  );
}

// ── Column width for the boxy grid ───────────────────────────────────────────
const COLW = 210;

// ── Hero background (subtle only — shapes live in layout) ────────────────────
function HeroDecor() {
  if (!IS_WEB) return null;
  return (
    <View style={[StyleSheet.absoluteFill, { overflow:'hidden' }]} pointerEvents="none">
      {/* faint crosshair */}
      <View style={{ position:'absolute', top:'50%', left:0, right:0, height:1, backgroundColor:'rgba(255,255,255,0.025)' }} />
      <View style={{ position:'absolute', left:'50%', top:0, bottom:0, width:1, backgroundColor:'rgba(255,255,255,0.025)' }} />
      {/* scan lines across whole section */}
      {Array.from({ length: 18 }).map((_, i) => (
        <View key={i} style={{
          position:'absolute', left:0, right:0, height:1,
          top:`${3 + i * (94 / 18)}%`,
          backgroundColor:'rgba(255,255,255,0.018)',
        }} />
      ))}
      {/* vertical gutter between top-left and top-right */}
      <View style={{ position:'absolute', top:58, bottom:'40%', left:'52%', width:1, backgroundColor:'rgba(255,255,255,0.06)' }} />
      {/* horizontal gutter between top and bottom zones */}
      <View style={{ position:'absolute', left:0, right:0, bottom:'32%', height:1, backgroundColor:'rgba(255,255,255,0.06)' }} />
      {/* corner labels */}
      <Text style={d.labelTL}>SYS.INIT  ·  RB</Text>
      <Text style={d.labelBR}>SCROLL ↓</Text>
    </View>
  );
}

// ── About sci-fi background decoration ───────────────────────────────────────
function AboutDecor() {
  if (!IS_WEB) return null;
  return (
    <View style={[StyleSheet.absoluteFill, { overflow:'hidden' }]} pointerEvents="none">

      {/* left accent rail */}
      <View style={d.rail} />

      {/* faint horizontal grid lines behind text */}
      {[25, 50, 75].map((pct) => (
        <View key={pct} style={{
          position:'absolute', left:52, right:COLW + 2, height:1, top:`${pct}%`,
          backgroundColor:'rgba(255,255,255,0.03)',
        }} />
      ))}

      {/* ── RIGHT COLUMN — flush to right edge ────────────────────────── */}
      <View style={gc.col('right')}>
        <HudWindow title="FLOW.RIBBON" sub="N=20  ·  SINE×2  ·  LIVE" cut={6} style={gc.win}>
          <WireFlow w={COLW} h={120} />
        </HudWindow>
        <HudWindow title="CYLINDER.MESH" sub="SEG: 18×10  ·  ROT" cut={6} style={gc.win}>
          <WireCylinder w={COLW} h={200} opacity={0.26} />
        </HudWindow>
        <HudWindow title="TERRAIN.SCAN" sub="ALTITUDE: DYNAMIC" cut={6} style={gc.win}>
          <WireTerrain w={COLW} h={108} opacity={0.22} />
        </HudWindow>
      </View>

      {/* gutter line */}
      <View style={{ position:'absolute', top:58, bottom:0, right:COLW, width:1, backgroundColor:'rgba(255,255,255,0.07)' }} />

      {/* corner labels */}
      <Text style={d.labelTR}>/ ABOUT  ·  01 OF 06</Text>
      <Text style={d.labelBL}>ROSE BILLINGTON  ·  DESIGNER</Text>
    </View>
  );
}

// ── Grid-column helpers ───────────────────────────────────────────────────────
const gc = {
  col: (side) => ({
    position: 'absolute',
    top: 58, bottom: 0,
    [side]: 0,
    width: COLW,
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 2,
  }),
  win: { width: COLW },
};

// ── Shared decoration styles ──────────────────────────────────────────────────
const d = StyleSheet.create({
  labelTL: {
    position:'absolute', top:66, left:8,
    fontFamily: BUNGEE, fontSize:8, letterSpacing:2,
    color:'rgba(255,255,255,0.22)', textTransform:'uppercase',
  },
  labelTR: {
    position:'absolute', top:66, right:8,
    fontFamily: BUNGEE, fontSize:8, letterSpacing:2,
    color:'rgba(255,255,255,0.22)', textTransform:'uppercase', textAlign:'right',
  },
  labelBL: {
    position:'absolute', bottom:8, left:8,
    fontFamily: BUNGEE, fontSize:8, letterSpacing:2,
    color:'rgba(255,255,255,0.22)', textTransform:'uppercase',
  },
  labelBR: {
    position:'absolute', bottom:8, right:8,
    fontFamily: BUNGEE, fontSize:8, letterSpacing:2,
    color:'rgba(255,255,255,0.22)', textTransform:'uppercase', textAlign:'right',
  },
  // About rail
  rail: {
    position:'absolute', top:0, bottom:0, left:36,
    width:1, backgroundColor:'rgba(255,255,255,0.1)',
  },
  railRight: {
    position:'absolute', top:0, bottom:0, right:32,
    width:1, backgroundColor:'rgba(255,255,255,0.04)',
  },
  // About top bar
  topBar: {
    position:'absolute', top:48, left:52, right:32,
    height:1, backgroundColor:'rgba(255,255,255,0.07)',
  },
  topBarNotch: {
    position:'absolute', top:44, left:52,
    width:1, height:9, backgroundColor:'rgba(255,255,255,0.2)',
  },
});

// ── Sci-fi panel box ─────────────────────────────────────────────────────────
function Panel({ children, style, cut = 18 }) {
  return (
    <View style={[s.panel, CLIP(cut), style]}>
      {/* top-right corner notch accent */}
      <View style={[s.panelNotchH, { width: cut + 4 }]} />
      <View style={[s.panelNotchV, { height: cut + 4 }]} />
      {children}
    </View>
  );
}

// ── Section 1 — Full Dashboard (Hero + About merged) ─────────────────────────
const DESIGN_W = 1400; // px — design-time width; everything scales from this

// ── HUD card overlay: tracers + corner brackets + scan line + coord label ─────
let _hudCssInjected = false;
const TRACER_PERIOD = 8; // seconds per full loop

function CardHud() {
  // Stable random values per card instance
  const countRef = useRef(Math.floor(Math.random() * 3) + 1); // 1–3 tracers
  const coordRef = useRef(
    `${Math.floor(Math.random()*0xFF).toString(16).toUpperCase().padStart(2,'0')}:` +
    `${Math.floor(Math.random()*0xFFFF).toString(16).toUpperCase().padStart(4,'0')}`
  );
  const scanDelayRef = useRef(`-${(Math.random() * 8).toFixed(1)}s`);

  useEffect(() => {
    if (!IS_WEB || _hudCssInjected) return;
    _hudCssInjected = true;
    const el = document.createElement('style');
    el.textContent = `
      @keyframes hudTracer {
        from { stroke-dashoffset: 0; }
        to   { stroke-dashoffset: -1000; }
      }
      @keyframes hudScan {
        0%   { top: -2px; opacity: 0;   }
        8%   { opacity: 0.45; }
        92%  { opacity: 0.45; }
        100% { top: calc(100% + 2px); opacity: 0; }
      }
      .hud-tracer {
        stroke-dasharray: 35 965;
        animation: hudTracer ${TRACER_PERIOD}s linear infinite;
        filter: drop-shadow(0 0 3px rgba(255,255,255,0.95)) drop-shadow(0 0 7px rgba(255,255,255,0.45));
      }
      .hud-scan {
        animation: hudScan 9s ease-in-out infinite;
      }
    `;
    document.head.appendChild(el);
  }, []);

  if (!IS_WEB) return null;

  const count = countRef.current;
  // Even time offsets so tracers are equally spaced around the perimeter
  const tracers = Array.from({ length: count }, (_, i) => ({
    delay: `-${((i / count) * TRACER_PERIOD).toFixed(2)}s`,
  }));

  const BK = 10; // bracket arm length
  const BT = 1;  // bracket line thickness
  const BC = 'rgba(255,255,255,0.4)';
  const corners = [
    { top:5, left:5,   borderTop:`${BT}px solid ${BC}`, borderLeft:`${BT}px solid ${BC}` },
    { top:5, right:5,  borderTop:`${BT}px solid ${BC}`, borderRight:`${BT}px solid ${BC}` },
    { bottom:5, left:5,  borderBottom:`${BT}px solid ${BC}`, borderLeft:`${BT}px solid ${BC}` },
    { bottom:5, right:5, borderBottom:`${BT}px solid ${BC}`, borderRight:`${BT}px solid ${BC}` },
  ];

  return (
    <div style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'hidden' }}>

      {/* ── Perimeter tracers ── */}
      <svg width="100%" height="100%" style={{ position:'absolute', inset:0, overflow:'visible' }}>
        {tracers.map((t, i) => (
          <rect key={i} className="hud-tracer"
            x="1" y="1" width="99%" height="99%"
            fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1"
            pathLength="1000"
            style={{ animationDelay: t.delay }}
          />
        ))}
      </svg>

      {/* ── Corner brackets ── */}
      {corners.map((st, i) => (
        <div key={i} style={{ position:'absolute', width:BK, height:BK, ...st }} />
      ))}

      {/* ── Horizontal scan line ── */}
      <div className="hud-scan" style={{
        position:'absolute', left:0, right:0, height:1,
        background:'linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.12) 20%,rgba(255,255,255,0.5) 50%,rgba(255,255,255,0.12) 80%,transparent 100%)',
        animationDelay: scanDelayRef.current,
      }} />

      {/* ── Corner coord label ── */}
      <div style={{
        position:'absolute', bottom:6, right:8,
        fontFamily:"'Bungee Hairline',monospace",
        fontSize:7, letterSpacing:1.5,
        color:'rgba(255,255,255,0.22)',
      }}>
        {coordRef.current}
      </div>

    </div>
  );
}

// ── Per-card tilt wrapper (web only) ─────────────────────────────────────────
function TiltCard({ children, webStyle }) {
  const cardRef  = useRef(null);
  const springRef = useRef({ x:0, y:0, vx:0, vy:0, tx:0, ty:0 });
  const rafRef   = useRef(null);

  useEffect(() => {
    if (!IS_WEB) return;
    const STIFF = 0.055, DAMP = 0.84;
    const loop = () => {
      const sp = springRef.current;
      sp.vx = sp.vx * DAMP + (sp.tx - sp.x) * STIFF;
      sp.vy = sp.vy * DAMP + (sp.ty - sp.y) * STIFF;
      sp.x += sp.vx;
      sp.y += sp.vy;
      if (cardRef.current) {
        cardRef.current.style.transform =
          `perspective(700px) rotateY(${sp.x.toFixed(4)}deg) rotateX(${(-sp.y).toFixed(4)}deg)`;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => {
    if (!IS_WEB) return;
    const el = cardRef.current;
    if (!el) return;
    const MAX = 2.5;
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      springRef.current.tx = ((e.clientX - r.left - r.width  / 2) / (r.width  / 2)) * MAX;
      springRef.current.ty = ((e.clientY - r.top  - r.height / 2) / (r.height / 2)) * MAX;
    };
    const onLeave = () => { springRef.current.tx = 0; springRef.current.ty = 0; };
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  if (!IS_WEB) return <>{children}</>;
  return (
    <div ref={cardRef} style={{ willChange:'transform', display:'flex', flexDirection:'column', position:'relative', ...webStyle }}>
      {children}
      <CardHud />
    </div>
  );
}

function HeroSection() {
  const [dashScale, setDashScale] = useState(1);

  // ── Responsive: scale the whole dashboard as one piece ─────────────────────
  useEffect(() => {
    if (!IS_WEB) return;
    const update = () => {
      const available = window.innerWidth - 64;
      setDashScale(Math.min(1, available / DESIGN_W));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // ── Shared dashboard JSX (used by both web & native paths) ─────────────────
  const dashInner = (
    <>
      {/* ── HEADER PANEL ── */}
      <Panel style={s.dashHeader} cut={16}>
        <Brackets size={14} color="rgba(255,255,255,0.16)" />
        <View style={s.dashNameBlock}>
          <Text style={s.heroName}>ROSE{'\n'}BILLINGTON</Text>
        </View>
        <View style={s.dashHeaderSep} />
        <View style={[s.dashHeaderMeta, { justifyContent:'center' }]}>
          <Text style={{ fontFamily: BUNGEE, fontSize: Platform.select({ web:64, default:36 }), letterSpacing: Platform.select({ web:14, default:6 }), color:'#fff', textTransform:'uppercase', opacity:0.92 }}>
            PORTFOLIO
          </Text>
        </View>
      </Panel>

      {/* ── DASHBOARD GRID — CSS grid on web for mixed tile sizes ── */}
      <View style={s.dashGridWeb}>

        {/* ABOUT — 3-wide big bio box */}
        <TiltCard webStyle={IS_WEB ? { gridArea:'about' } : undefined}>
        <Panel style={[s.bottomCardPad, { flex:1, justifyContent:'space-between' }]} cut={14}>
          <View style={{ flex:1, overflow:'hidden' }}>
            <Brackets size={14} color="rgba(255,255,255,0.12)" />
            <Text style={[s.bigBio, s.glowText]}>ABOUT</Text>
            <View style={[s.aboutDivider, { marginBottom:14 }]} />
            <Text style={s.aboutBody}>
              HI — I'M ROSE. A 25-YEAR-OLD GRAPHIC &amp; WEB DESIGNER BASED IN MASSACHUSETTS.{'\n\n'}
              Over the last 4 years I've worked across branding, UI/UX, and web,
              turning complex ideas into clean, considered visuals.
            </Text>
          </View>
          <TouchableOpacity style={s.discoverMini} activeOpacity={0.8}>
            <Text style={s.discoverMiniTxt}>DISCOVER  ▶</Text>
          </TouchableOpacity>
        </Panel>
        </TiltCard>

        {/* SPHERE — 1×1 (row 1 col 4) */}
        <TiltCard webStyle={IS_WEB ? { gridArea:'sphere' } : undefined}>
        <HudWindow title="RENDER.3D — ICOSPHERE" sub="POLY: ICO-2  ·  ROTATING  ·  ACTIVE" cut={10} style={{ flex:1, width:'100%' }}>
          <WireSphere size={Platform.select({ web:240, default:150 })} opacity={0.32} />
        </HudWindow>
        </TiltCard>

        {/* BIO — tall 1×2 (rows 2-3, col 1) */}
        <TiltCard webStyle={IS_WEB ? { gridArea:'bio' } : undefined}>
        <Panel style={[s.bottomCardPad, { flex:1 }]} cut={10}>
          <Text style={s.bottomTag}>/ BIO</Text>
          <Text style={s.heroTitle}>GRAPHIC  &amp;  WEB  DESIGNER</Text>
          <Text style={[s.heroMetaText, { marginTop:6, marginBottom:14 }]}>25 YRS  ·  4 YRS EXP  ·  MASSACHUSETTS</Text>
          <Text style={s.bottomBody}>
            Designer based in Massachusetts.{'\n\n'}
            4 years turning complex ideas into clean, considered visuals across branding, UI/UX and web.
          </Text>
          <View style={{ marginTop:12, gap:5 }}>
            {['STATUS: ACTIVE','BUILD: 2025','MODE: DISPLAY','NET: ONLINE'].map((line, i) => (
              <View key={i} style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
                <View style={{ width:3, height:3, borderRadius:2, backgroundColor:'rgba(255,255,255,0.35)' }} />
                <Text style={s.dashMetaLine}>{line}</Text>
              </View>
            ))}
          </View>
        </Panel>
        </TiltCard>

        {/* FLOW RIBBON — wide 2×1 (row 2, cols 2-3) */}
        <TiltCard webStyle={IS_WEB ? { gridArea:'flow' } : undefined}>
        <HudWindow title="FLOW.RIBBON — LINE ART" sub="N=20  ·  SINE×2  ·  LIVE" cut={8} style={{ flex:1, width:'100%' }}>
          <WireFlowFill h={Platform.select({ web:165, default:80 })} />
        </HudWindow>
        </TiltCard>

        {/* DNA — tall 1×2 (rows 2-3, col 4) */}
        <TiltCard webStyle={IS_WEB ? { gridArea:'dna' } : undefined}>
        <HudWindow title="DNA.HELIX — DOUBLE STRAND" sub="CYCLES: 6  ·  LIVE" cut={8} style={{ flex:1, width:'100%' }}>
          <WireDNA w={Platform.select({ web:180, default:90 })} h={Platform.select({ web:390, default:180 })} opacity={0.34} />
        </HudWindow>
        </TiltCard>

        {/* TERRAIN — wide 2×1 (row 3, cols 2-3) */}
        <TiltCard webStyle={IS_WEB ? { gridArea:'terrain' } : undefined}>
        <HudWindow title="TERRAIN.SCAN" sub="ALTITUDE: DYNAMIC" cut={8} style={{ flex:1, width:'100%' }}>
          <WireTerrain w={Platform.select({ web:600, default:260 })} h={Platform.select({ web:205, default:100 })} opacity={0.22} />
        </HudWindow>
        </TiltCard>

      </View>

      {/* ── SCROLL HINT ── */}
      <View style={s.scrollHint}>
        <Text style={[s.scrollHintText, s.glowText]}>SCROLL TO EXPLORE</Text>
        <Text style={[s.scrollArrow, s.glowText]}>↓</Text>
      </View>
    </>
  );

  return (
    <View nativeID="hero-section" style={[s.section, s.heroSection]}>
      <HeroDecor />

      {IS_WEB ? (
        /*
         * Web: outer div provides visible bounds and responsive scaling.
         * Inner scale div is pinned to DESIGN_W px wide and CSS-zoomed to fit
         * the viewport — everything inside scales proportionally as one piece.
         * Each card has its own TiltCard wrapper with independent spring physics.
         */
        <div style={{ width:'100%', display:'flex', justifyContent:'center' }}>
          <div style={{ width: DESIGN_W, zoom: dashScale, transformOrigin:'top center', display:'flex', flexDirection:'column', gap:8 }}>
            {dashInner}
          </div>
        </div>
      ) : dashInner}
    </View>
  );
}

// ── Section 2 — About / Bio ───────────────────────────────────────────────────
function AboutSection() {
  return (
    <View style={[s.section, s.aboutSection]}>
      <AboutDecor />

      {/* section tag — outside panel */}
      <Text style={s.sectionTag}>/ 01  ABOUT</Text>

      {/* body panel */}
      <Panel style={s.aboutPanel} cut={20}>
        <Text style={s.aboutHeading}>DESIGN IS HOW{'\n'}I THINK.</Text>
        <View style={s.aboutDivider} />
        <Text style={s.aboutBody}>
          Hi — I'm Rose. A 25-year-old graphic and web designer based out of
          Massachusetts. Over the last 4 years I've worked across branding,
          UI/UX, and web, turning complex ideas into clean, considered visuals.
          {'\n\n'}
          This portfolio is a living document of that work — built to be
          explored, not just scrolled. Use the planet system below to jump
          between disciplines, or keep scrolling for the full story.
        </Text>
      </Panel>
    </View>
  );
}

export default function App() {
  const progressRef    = useRef(0);
  const scrollRef      = useRef(null);
  const pagesRef       = useRef(null); // the sliding pages container (web)
  const pageIndexRef   = useRef(0);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [activeTab, setActiveTab]         = useState('discover');

  // Force black background
  if (IS_WEB && typeof document !== 'undefined') {
    document.documentElement.style.background = '#000';
    document.body.style.background            = '#000';
    document.body.style.margin                = '0';
    document.body.style.userSelect            = 'none';
    document.body.style.webkitUserSelect      = 'none';
  }

  // ── Web scroll system ────────────────────────────────────────────────────────
  // Uses CSS transform (no scroll container) so Chrome pull-to-refresh is impossible.
  useEffect(() => {
    if (!IS_WEB) return;

    const THRESHOLD     = 200; // accumulated wheel delta needed to snap
    const TOTAL_PAGES   = 2;   // 0 = dashboard, 1 = solar system
    const SPARKLE_COUNT = 75;
    let accumulated = 0;
    let isSnapping  = false;
    let wheelTimer  = null;
    // Indirection so onWheel can call the dot-aware snap once dots are set up
    const snapRef = { fn: null };

    // ── Pages container transform ─────────────────────────────────────────────
    const setPages = (page, offsetY = 0, squish = 1, transition = 'none') => {
      const el = pagesRef.current;
      if (!el) return;
      el.style.transition = transition;
      el.style.transform  = `translateY(calc(${-page * 100}vh + ${offsetY}px)) scaleY(${squish})`;
    };

    // ── Hero fade ─────────────────────────────────────────────────────────────
    const heroEl = () => document.getElementById('hero-section');

    const fadeHero = (inOut) => {
      const el = heroEl();
      if (!el) return;
      if (inOut === 'out') {
        el.style.transition = 'opacity 0.45s ease';
        el.style.opacity    = '0';
      } else {
        el.style.opacity    = '0';
        el.style.transition = 'none';
        setTimeout(() => {
          el.style.transition = 'opacity 0.6s ease';
          el.style.opacity    = '1';
        }, 1500);
      }
    };

    // ── Snap to page ──────────────────────────────────────────────────────────
    // ── Page navigation dots (right-rail) ────────────────────────────────────
    const dotStyle = document.createElement('style');
    dotStyle.textContent = `
      @keyframes pageDotPulse {
        0%,100% { box-shadow: 0 0 4px 1px currentColor; }
        50%      { box-shadow: 0 0 10px 3px currentColor; }
      }
      #page-nav-dots {
        position: fixed;
        right: 22px;
        top: 50%;
        transform: translateY(-50%);
        z-index: 20000;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        pointer-events: auto;
        transition: opacity 0.3s;
      }
      #page-nav-dots.hidden {
        opacity: 0;
        pointer-events: none;
      }
      .page-nav-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        border: 1px solid rgba(255,255,255,0.45);
        background: transparent;
        cursor: pointer;
        transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), background 0.3s, opacity 0.3s;
        opacity: 0.35;
        color: rgba(255,255,255,0.8);
      }
      .page-nav-dot:hover {
        opacity: 0.8;
        transform: scale(1.4);
      }
      .page-nav-dot.active {
        background: rgba(255,255,255,0.85);
        opacity: 1;
        transform: scale(1.3);
        animation: pageDotPulse 2.2s ease-in-out infinite;
      }
    `;
    document.head.appendChild(dotStyle);

    // ── Back to Dashboard button ──────────────────────────────────────────────
    const backBtnStyle = document.createElement('style');
    backBtnStyle.textContent = `
      #back-to-dashboard {
        position: fixed;
        top: 88px;
        left: 32px;
        z-index: 20000;
        background: rgba(0,0,0,0.55);
        border: none;
        color: #fff;
        font-family: 'Bungee Hairline', sans-serif;
        font-size: 13px;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        padding: 8px 20px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.4s;
        overflow: visible;
        white-space: nowrap;
      }
      #back-to-dashboard.visible {
        opacity: 1;
        pointer-events: auto;
      }
      #back-to-dashboard:hover { color: rgba(255,255,255,0.8); }
    `;
    document.head.appendChild(backBtnStyle);

    const backBtn = document.createElement('button');
    backBtn.id = 'back-to-dashboard';
    backBtn.innerHTML = `<span style="font-size:16px;line-height:1;">←</span><span>BACK TO DASHBOARD</span>`;
    backBtn.addEventListener('click', () => {
      if (!isSnapping) (snapRef.fn || snapTo)(0);
    });
    document.body.appendChild(backBtn);

    const navDotsEl = document.createElement('div');
    navDotsEl.id = 'page-nav-dots';
    const navDotEls = Array.from({ length: TOTAL_PAGES }, (_, i) => {
      const d = document.createElement('div');
      d.className = 'page-nav-dot' + (i === 0 ? ' active' : '');
      d.addEventListener('click', () => {
        if (!isSnapping) (snapRef.fn || snapTo)(i);
      });
      navDotsEl.appendChild(d);
      return d;
    });
    document.body.appendChild(navDotsEl);

    // ── Dashboard controls hint (bottom-left, page 0 only) ────────────────────
    const dashHintStyle = document.createElement('style');
    dashHintStyle.textContent = `
      #dash-controls {
        position: fixed;
        bottom: 24px;
        left: 28px;
        z-index: 20000;
        display: flex;
        align-items: center;
        gap: 18px;
        opacity: 1;
        pointer-events: none;
        transition: opacity 0.4s;
        font-family: 'Bungee Hairline', sans-serif;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        white-space: nowrap;
      }
      #dash-controls.hidden { opacity: 0; }
    `;
    document.head.appendChild(dashHintStyle);

    const dashControls = document.createElement('div');
    dashControls.id = 'dash-controls';
    dashControls.innerHTML = `
      <div class="kb-group">
        <div class="kb-key">
          <svg width="13" height="10" viewBox="0 0 10 8" fill="none"><path d="M1 1L5 6.5L9 1" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <div class="kb-sep"></div>
        <div class="kb-key" style="min-width:48px;">ENTER</div>
        <span>DISCOVER</span>
      </div>
    `;
    dashControls.classList.add('hidden'); // start hidden, delay on first show
    document.body.appendChild(dashControls);

    let dashHintTimer = null;
    let dashBtnSuppressed = false;
    window._setDashBtnVisible = (show) => {
      dashBtnSuppressed = !show;
      backBtn.classList.toggle('visible', show && pageIndexRef.current !== 0);
      navDotsEl.classList.toggle('hidden', !show);
    };

    const updateNavDots = (page) => {
      navDotEls.forEach((d, i) => d.classList.toggle('active', i === page));
      backBtn.classList.toggle('visible', page !== 0 && !dashBtnSuppressed);
      clearTimeout(dashHintTimer);
      if (page === 0) {
        dashHintTimer = setTimeout(() => dashControls.classList.remove('hidden'), 800);
      } else {
        dashControls.classList.add('hidden');
      }
    };

    // Show dashboard hint after initial load delay
    dashHintTimer = setTimeout(() => dashControls.classList.remove('hidden'), 800);

    const snapTo = (index) => {
      if (isSnapping) return;
      if (window._inPlanetDetail) return;
      isSnapping = true;
      pageIndexRef.current = index;
      updateNavDots(index);

      if (index === 1) {
        fadeHero('out');
        progressRef.current = 0.5; // put solar system in range
      } else {
        fadeHero('in');
        progressRef.current = 0;
      }

      setPages(index, 0, 1, 'transform 0.65s cubic-bezier(0.4, 0, 0.2, 1)');
      setTimeout(() => {
        setPages(index, 0, 1, 'none'); // clear transition after done
        isSnapping  = false;
        accumulated = 0;
      }, 700);
    };

    // ── Sparkle overlay ───────────────────────────────────────────────────────
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed', left: '-80%', right: '-80%',
      height: '0px', pointerEvents: 'none', zIndex: '9999',
      opacity: '1', overflow: 'hidden',
      borderRadius: '50% / 100% 100% 0 0', // flat at bottom, curved top — flipped per dir
    });
    const animRoot = document.getElementById('root') || document.body;
    animRoot.appendChild(overlay);

    const sparkleBox = document.createElement('div');
    Object.assign(sparkleBox.style, {
      position: 'fixed', left: '-80%', right: '-80%',
      height: '200px', pointerEvents: 'none', zIndex: '10000', opacity: '0',
    });
    animRoot.appendChild(sparkleBox);

    // ── Elliptical arc lines ──────────────────────────────────────────────────
    // Each line is a concentric ellipse arc that follows the container curve,
    // with a gentle ripple animation and per-line blur for depth.
    const LINE_COUNT = 8;
    const lineSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    Object.assign(lineSvg.style, {
      position: 'absolute', inset: '0', width: '100%', height: '100%',
      overflow: 'hidden', pointerEvents: 'none',
    });
    overlay.appendChild(lineSvg);

    // One <g> per line so we can apply individual blur filters
    const linePaths = Array.from({ length: LINE_COUNT }, (_, i) => {
      const frac    = i / (LINE_COUNT - 1);  // 0 = near edge, 1 = deep inside
      const opacity = 0.18 + frac * 0.55;
      const sw      = 0.4 + frac * 1.0;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', `rgba(255,255,255,${opacity.toFixed(2)})`);
      path.setAttribute('stroke-width', sw.toFixed(1));
      path.setAttribute('stroke-linecap', 'round');
      path.style.filter = `blur(${(4.5 - frac * 3.0).toFixed(1)}px) drop-shadow(0 0 ${(6 + frac * 16).toFixed(0)}px rgba(255,255,255,${(0.2 + frac * 0.4).toFixed(2)}))`;
      lineSvg.appendChild(path);
      return path;
    });

    const linePhases = Array.from({ length: LINE_COUNT }, (_, i) => (i / LINE_COUNT) * Math.PI * 2);
    const lineSpeeds = Array.from({ length: LINE_COUNT }, () => 0.2 + Math.random() * 0.3);
    let lineRaf     = null;
    let lineProgress = 0;
    let lineVisible  = false;
    let lineDir      = 'down';

    const updateLines = (ts) => {
      if (!lineVisible) return;
      lineRaf = requestAnimationFrame(updateLines);
      const t = ts * 0.001;
      const W = lineSvg.clientWidth  || window.innerWidth;
      const H = lineSvg.clientHeight || 200;

      linePaths.forEach((path, i) => {
        const frac  = i / (LINE_COUNT - 1); // 0 = edge, 1 = deep
        // Each line sits at a different depth in the ellipse.
        // For dir=down: ellipse opens upward, so depth 0 is near the bottom (flat),
        // depth 1 is near the peak of the arc (most curved, highest).
        const depth = frac;                             // 0..1
        const ellipseY = lineDir === 'down'
          ? H * (1 - depth * 0.92)                     // near bottom → near top
          : H * depth * 0.92;

        // Arc offset: the ellipse arc means mid-x is higher than edges.
        // Model as a quadratic: centre_y = ellipseY ± arcLift, edges at ellipseY
        const arcLift  = depth * H * (0.85 + lineProgress * 1.4); // bends harder as you drag
        const ripple   = Math.sin(t * lineSpeeds[i] + linePhases[i]) * lineProgress * 14 * depth;
        const ripple2  = Math.sin(t * lineSpeeds[i] * 1.4 + linePhases[i] + 1) * lineProgress * 6;

        const cx  = W / 2;
        const cy  = lineDir === 'down'
          ? ellipseY - arcLift + ripple + ripple2
          : ellipseY + arcLift + ripple + ripple2;

        // Cubic bezier: flat at edges, arcs to cy at centre
        const d = `M 0 ${ellipseY.toFixed(1)} C ${(cx * 0.5).toFixed(1)} ${ellipseY.toFixed(1)} ${(cx * 0.5).toFixed(1)} ${cy.toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)} S ${(cx * 1.5).toFixed(1)} ${ellipseY.toFixed(1)} ${W.toFixed(1)} ${ellipseY.toFixed(1)}`;
        path.setAttribute('d', d);
      });
    };

    const startLines = (prog, dir) => {
      lineProgress = prog; // updated every frame so bend scales live with drag
      lineDir = dir;
      if (!lineVisible) {
        lineVisible = true;
        lineRaf = requestAnimationFrame(updateLines);
      }
    };
    const stopLines = () => {
      lineVisible = false;
      cancelAnimationFrame(lineRaf);
      linePaths.forEach(p => p.setAttribute('d', ''));
    };

    const sfStyle = document.createElement('style');
    let kf = '';
    for (let i = 0; i < SPARKLE_COUNT; i++) {
      const rot = 180 + Math.random() * 80;
      kf += `@keyframes _sf${i}{0%{transform:translateY(0) scale(0) rotate(0deg);opacity:0}25%{opacity:0.9}100%{transform:translateY(-70px) scale(1) rotate(${rot}deg);opacity:0}}\n`;
    }
    sfStyle.textContent = kf;
    document.head.appendChild(sfStyle);

    for (let i = 0; i < SPARKLE_COUNT; i++) {
      const s = document.createElement('div');
      const sz = 0.5 + Math.random() * 0.8;
      const dur = 2.0 + Math.random() * 2.5;
      Object.assign(s.style, {
        position: 'absolute', width: `${sz}px`, height: `${sz}px`,
        borderRadius: '50%', background: 'white',
        left: `${Math.random() * 100}%`, bottom: `${Math.random() * 80}%`,
        boxShadow: '0 0 3px 1px rgba(255,255,255,0.3)',
        animation: `_sf${i} ${dur}s ${(Math.random() * dur).toFixed(2)}s ease-out infinite`,
      });
      sparkleBox.appendChild(s);
    }

    const showEdge = (progress, dir) => {
      const pullH = Math.round(Math.sqrt(progress) * 120);
      const alpha = 0.04 + progress * 0.12;
      const glow  = `rgba(255,255,255,${alpha})`;
      const mid   = `rgba(255,255,255,${alpha * 0.4})`;
      if (dir === 'down') {
        overlay.style.top    = 'auto'; overlay.style.bottom = '0';
        overlay.style.background = `linear-gradient(to top,${glow},${mid},transparent)`;
        overlay.style.borderRadius = '50% / 100% 100% 0 0'; // curve faces up
        sparkleBox.style.top = 'auto'; sparkleBox.style.bottom = '-80px';
      } else {
        overlay.style.bottom = 'auto'; overlay.style.top = '0';
        overlay.style.background = `linear-gradient(to bottom,${glow},${mid},transparent)`;
        overlay.style.borderRadius = '50% / 0 0 100% 100%'; // curve faces down
        sparkleBox.style.bottom = 'auto'; sparkleBox.style.top = '-80px';
      }
      overlay.style.transition  = '';
      overlay.style.height      = `${pullH}px`;
      sparkleBox.style.opacity  = progress > 0.05 ? '1' : '0';
      sparkleBox.style.height   = `${pullH + 80}px`;
      startLines(progress, dir);

      // Stretch pages
      const pull   = Math.sqrt(progress) * 80 * (dir === 'down' ? -1 : 1);
      const squish = 1 - progress * 0.012;
      setPages(pageIndexRef.current, pull, squish, 'none');
    };

    const hideEdge = (didSnap) => {
      stopLines();
      // Bounce back or clear
      if (!didSnap) {
        setPages(pageIndexRef.current, 0, 1, 'transform 0.55s cubic-bezier(0.25,1.4,0.5,1)');
        setTimeout(() => setPages(pageIndexRef.current, 0, 1, 'none'), 600);
      }
      overlay.style.transition  = 'height 1.2s cubic-bezier(0.25,1,0.5,1), opacity 1s ease';
      sparkleBox.style.transition = 'opacity 0.8s ease';
      overlay.style.height      = '0px';
      overlay.style.opacity     = '0';
      sparkleBox.style.opacity  = '0';
      setTimeout(() => {
        overlay.style.opacity    = '1';
        overlay.style.transition = '';
        sparkleBox.style.transition = '';
      }, 1200);
    };

    // ── Wheel handler ─────────────────────────────────────────────────────────
    const onWheel = (e) => {
      e.preventDefault(); // always block — no scroll container exists anyway

      // Yield to the carousel when hovering over it
      if (window._pcHovered) return;
      if (window._inPlanetDetail) return;
      if (window._solarLocked) return;

      if (isSnapping) return;

      accumulated += e.deltaY;
      const clamped  = Math.max(-THRESHOLD, Math.min(THRESHOLD, accumulated));
      const progress = Math.abs(clamped) / THRESHOLD;
      const dir      = accumulated > 0 ? 'down' : 'up';
      const page     = pageIndexRef.current;

      // Hard boundaries — silently ignore, no animation
      if ((page === 0 && dir === 'up') || (page === TOTAL_PAGES - 1 && dir === 'down')) {
        accumulated = 0;
        return;
      }

      showEdge(progress, dir);

      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => {
        if (Math.abs(accumulated) >= THRESHOLD) {
          const next = dir === 'down' ? page + 1 : page - 1;
          hideEdge(true);
          setTimeout(() => (snapRef.fn || snapTo)(next), 30);
        } else {
          hideEdge(false);
        }
        accumulated = 0;
      }, 100);
    };

    // Capture phase — fires before any browser default including pull-to-refresh
    document.addEventListener('wheel',     onWheel,                  { passive: false, capture: true });
    document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false, capture: true });

    snapRef.fn = snapTo;

    // ── Keyboard arrow navigation ─────────────────────────────────────────────
    // Left/Right → cycle the skill carousel   Up/Down → change page
    const onKeyDown = (e) => {
      const page = pageIndexRef.current;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (!e.repeat) window._pcNext?.();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (!e.repeat) window._pcPrev?.();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = page + 1;
        if (next < TOTAL_PAGES && !isSnapping && !window._inPlanetDetail && !window._solarLocked) snapRef.fn(next);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const next = page - 1;
        if (next >= 0 && !isSnapping && !window._inPlanetDetail && !window._solarLocked) snapRef.fn(next);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (page === 0) {
          if (!isSnapping) snapRef.fn(1);
        } else {
          window._pcEnter?.();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (!isSnapping && page !== 0 && !window._inPlanetDetail && !window._solarLocked) (snapRef.fn || snapTo)(0);
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('wheel', onWheel, { capture: true });
      document.removeEventListener('keydown', onKeyDown);
      stopLines();
      overlay.remove();
      sparkleBox.remove();
      sfStyle.remove();
      navDotsEl.remove();
      dotStyle.remove();
      dashControls.remove();
      dashHintStyle.remove();
      clearTimeout(dashHintTimer);
      clearTimeout(wheelTimer);
    };
  }, []);

  // Native scroll → progress
  const handleScroll = useCallback((e) => {
    const y = e.nativeEvent.contentOffset.y;
    progressRef.current = Math.max(0, Math.min(1, y / (SCREEN_H * 2)));
  }, []);

  return (
    <View style={s.root}>
      <StatusBar style="light" />

      {/* Background canvas */}
      <ParticleWave progressRef={progressRef} setScrollEnabled={setScrollEnabled} />

      {/* Fixed nav */}
      <TopBar activeTab={activeTab} onTab={setActiveTab} />

      {IS_WEB ? (
        /*
         * Web: fixed outer box with overflow:hidden — no scroll container exists.
         * Chrome cannot trigger pull-to-refresh on a non-scrollable element.
         * Pages slide via CSS transform on the inner div.
         */
        <div style={{
          position: 'fixed', inset: 0,
          overflow: 'hidden',
          touchAction: 'none',   // also blocks touch pull-to-refresh
          zIndex: 1,
        }}>
          <div ref={pagesRef} style={{ willChange: 'transform', transformOrigin: 'center top' }}>
            <HeroSection />
            <View style={s.section} />
          </div>
        </div>
      ) : (
        /* Native: standard paging ScrollView */
        <ScrollView
          ref={scrollRef}
          style={s.scroll}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          scrollEnabled={scrollEnabled}
          pagingEnabled
          decelerationRate="fast"
        >
          <HeroSection />
          <View style={s.section} />
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:  { flex:1, backgroundColor:'#000' },
  scroll: { flex:1, zIndex:1 },

  // ── shared section shell ───────────────────────────────────────────────────
  section: {
    height: SCREEN_H,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Platform.select({ web:'14%', default:28 }),
  },

  // ── Panel (shared) ────────────────────────────────────────────────────────
  panel: {
    backgroundColor: 'rgba(0,0,0,0.58)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    position: 'relative',
    ...BLUR,
  },
  // top-right corner notch accent lines
  panelNotchH: {
    position:'absolute', top:0, right:0, height:1,
    backgroundColor:'rgba(255,255,255,0.35)',
  },
  panelNotchV: {
    position:'absolute', top:0, right:0, width:1,
    backgroundColor:'rgba(255,255,255,0.35)',
  },

  // ── Hero layout ────────────────────────────────────────────────────────────
  heroSection: {
    height: SCREEN_H,
    overflow: 'hidden',
    paddingHorizontal: Platform.select({ web:32, default:12 }),
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    paddingTop: 66,
    paddingBottom: 12,
    gap: 8,
  },

  // ── Dashboard header panel (PORTFOLIO + ROSE BILLINGTON) ─────────────────
  dashHeader: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: Platform.select({ web:120, default:100 }),
  },
  dashNameBlock: {
    flex: 1.1,
    paddingHorizontal: Platform.select({ web:28, default:16 }),
    paddingVertical: Platform.select({ web:22, default:14 }),
    justifyContent: 'center',
  },
  dashPortfolioTag: {
    fontFamily: BUNGEE,
    fontSize: Platform.select({ web:10, default:8 }),
    letterSpacing: Platform.select({ web:10, default:5 }),
    color: 'rgba(255,255,255,0.35)',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  dashNameDivider: {
    width: 36,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: 10,
  },
  dashHeaderSep: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 20,
  },
  dashHeaderMeta: {
    flex: 1,
    paddingHorizontal: Platform.select({ web:28, default:16 }),
    paddingVertical: Platform.select({ web:22, default:14 }),
    justifyContent: 'center',
  },
  dashMetaLine: {
    fontFamily: BUNGEE,
    fontSize: 8,
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.32)',
    textTransform: 'uppercase',
    lineHeight: 14,
  },

  // ── Dashboard CSS grid — 4 cols, 4 rows, proper 1x/2x/3x variety ──────────
  dashGridWeb: IS_WEB ? {
    display: 'grid',
    gridTemplateColumns: '1.5fr 1.2fr 1.1fr 1fr',
    gridTemplateRows: '240px 175px 200px',
    gridTemplateAreas: `
      "about   about   about   sphere "
      "bio     flow    flow    dna    "
      "bio     terrain terrain dna    "
    `,
    gap: 8,
    alignSelf: 'stretch',
  } : {
    gap: 8,
    alignSelf: 'stretch',
  },
  dashCell: {
    flex: 1,
  },
  dashCellWide: {
    flex: 1.6,
  },

  // HUD horizontal rule
  hudRule: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hudRuleLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  hudRuleLabel: {
    fontFamily: BUNGEE,
    fontSize: 7,
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.28)',
    textTransform: 'uppercase',
  },

  // name + title
  heroName: {
    fontFamily: RUBIK,
    fontSize: Platform.select({ web:71, default:41 }),
    letterSpacing: Platform.select({ web:4, default:2 }),
    color: '#fff',
    lineHeight: Platform.select({ web:84, default:54 }),
    textTransform: 'uppercase',
    paddingRight: Platform.select({ web:4, default:2 }),
  },
  heroTitle: {
    fontFamily: RUBIK,
    fontSize: Platform.select({ web:12, default:10 }),
    letterSpacing: Platform.select({ web:4, default:2 }),
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
  },
  heroMetaText: {
    fontFamily: BUNGEE,
    fontSize: Platform.select({ web:9, default:8 }),
    letterSpacing: Platform.select({ web:2, default:1 }),
    color: 'rgba(255,255,255,0.35)',
    textTransform: 'uppercase',
  },

  // shared card styles
  bottomCard: {
    flex: 1,
  },
  bottomCardPad: {
    padding: Platform.select({ web:16, default:12 }),
    justifyContent: 'space-between',
  },
  bottomTag: {
    fontFamily: BUNGEE,
    fontSize: 9,
    letterSpacing: 3,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 10,
  },
  bottomBody: {
    fontFamily: RUBIK,
    fontSize: Platform.select({ web:11, default:9 }),
    color: 'rgba(255,255,255,0.45)',
    lineHeight: Platform.select({ web:20, default:15 }),
    flex: 1,
  },
  discoverMini: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    alignSelf: 'flex-start',
    marginTop: 10,
    ...(IS_WEB ? { clipPath:'polygon(0 0,calc(100% - 6px) 0,100% 6px,100% 100%,6px 100%,0 calc(100% - 6px))' } : {}),
  },
  discoverMiniTxt: {
    fontFamily: BUNGEE,
    fontSize: 9,
    letterSpacing: 3,
    color: '#fff',
  },

  // scroll hint + glow
  scrollHint: {
    height: Platform.select({ web:52, default:44 }),
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  scrollHintText: {
    fontFamily: BUNGEE,
    fontSize: 9,
    letterSpacing: 5,
    color: 'rgba(255,255,255,0.7)',
  },
  scrollArrow: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
  },
  glowText: {
    textShadowColor: 'rgba(255,255,255,0.9)',
    textShadowOffset: { width:0, height:0 },
    textShadowRadius: Platform.select({ web:14, default:8 }),
  },

  // ── About ──────────────────────────────────────────────────────────────────
  aboutSection: {
    alignItems: 'flex-start',
    paddingHorizontal: Platform.select({ web:'14%', default:28 }),
    gap: 0,
  },

  aboutPanel: {
    alignSelf: 'stretch',
    padding: Platform.select({ web:40, default:24 }),
  },

  sectionTag: {
    fontFamily: BUNGEE,
    fontSize: 10,
    letterSpacing: 5,
    color: 'rgba(255,255,255,0.35)',
    textTransform: 'uppercase',
    marginBottom: 14,
  },

  bigBio: {
    fontFamily: RUBIK,
    fontSize: Platform.select({ web:28, default:18 }),
    letterSpacing: Platform.select({ web:2, default:1 }),
    color: '#fff',
    textTransform: 'uppercase',
    lineHeight: Platform.select({ web:38, default:26 }),
    marginBottom: 16,
  },

  aboutHeading: {
    fontFamily: RUBIK,
    fontSize: Platform.select({ web:64, default:40 }),
    letterSpacing: Platform.select({ web:2, default:1 }),
    color: '#fff',
    textTransform: 'uppercase',
    lineHeight: Platform.select({ web:74, default:50 }),
    marginBottom: 28,
  },

  aboutDivider: {
    width: 40,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginBottom: 28,
  },

  aboutBody: {
    fontFamily: RUBIK,
    fontSize: Platform.select({ web:13, default:12 }),
    color: 'rgba(255,255,255,0.8)',
    lineHeight: Platform.select({ web:26, default:22 }),
    maxWidth: 560,
    marginBottom: 36,
  },

});

// ── Nav bar styles ────────────────────────────────────────────────────────────
const n = StyleSheet.create({
  bar: {
    position: Platform.select({ web: 'fixed', default: 'absolute' }),
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20000,
    height: Platform.select({ web:58, default:52 }),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Platform.select({ web:32, default:16 }),
    // frosted black strip
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    // web-only backdrop blur injected below
    ...(IS_WEB ? { backdropFilter:'blur(14px)', WebkitBackdropFilter:'blur(14px)' } : {}),
  },

  // ── wordmark (left) ──────────────────────────────────────────────────────
  wordmark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  wordmarkInitials: {
    fontFamily: BUNGEE,
    fontSize: Platform.select({ web:20, default:16 }),
    letterSpacing: 4,
    color: '#fff',
  },
  wordmarkDivider: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  wordmarkFull: {
    fontFamily: BUNGEE,
    fontSize: Platform.select({ web:11, default:9 }),
    letterSpacing: Platform.select({ web:5, default:3 }),
    color: 'rgba(255,255,255,0.45)',
  },

  // ── tab strip (right) ────────────────────────────────────────────────────
  tabs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Platform.select({ web:4, default:2 }),
  },

  // plain tab
  tab: {
    paddingHorizontal: Platform.select({ web:14, default:8 }),
    paddingVertical: 6,
    position: 'relative',
    alignItems: 'center',
  },
  tabTxt: {
    fontFamily: BUNGEE,
    fontSize: Platform.select({ web:10, default:8 }),
    letterSpacing: Platform.select({ web:3, default:2 }),
    color: 'rgba(255,255,255,0.38)',
    textTransform: 'uppercase',
  },
  tabTxtActive: {
    color: '#fff',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 14,
    right: 14,
    height: 1,
    backgroundColor: '#fff',
  },

  // big Discover button
  discoverBtn: {
    marginLeft: Platform.select({ web:10, default:4 }),
    paddingHorizontal: Platform.select({ web:22, default:14 }),
    paddingVertical: Platform.select({ web:9, default:7 }),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    backgroundColor: 'transparent',
    // angular clip on web
    ...(IS_WEB ? { clipPath:'polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,8px 100%,0 calc(100% - 8px))' } : {}),
  },
  discoverBtnActive: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  discoverTxt: {
    fontFamily: BUNGEE,
    fontSize: Platform.select({ web:11, default:9 }),
    letterSpacing: Platform.select({ web:5, default:3 }),
    color: '#fff',
    textTransform: 'uppercase',
  },
  discoverTxtActive: {
    color: '#000',
  },
});

// ── HUD window styles ─────────────────────────────────────────────────────────
const hw = StyleSheet.create({
  win: {
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    ...BLUR,
  },
  // title bar
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  barTitle: {
    fontFamily: BUNGEE,
    fontSize: 8,
    letterSpacing: 2.5,
    color: 'rgba(255,255,255,0.65)',
    textTransform: 'uppercase',
  },
  barDots: {
    flexDirection: 'row',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  // content area — fills available space, centres the canvas
  body: {
    flex: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // footer status bar
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  footPulse: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  footText: {
    fontFamily: BUNGEE,
    fontSize: 7.5,
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.3)',
    textTransform: 'uppercase',
  },
});

// ── Skill bar styles ──────────────────────────────────────────────────────────
const sk = StyleSheet.create({
  row:    { flexDirection:'row', alignItems:'center', gap:8, marginBottom:8 },
  label:  { fontFamily:BUNGEE, fontSize:8, letterSpacing:2, color:'rgba(255,255,255,0.5)', width:54 },
  track:  { flex:1, flexDirection:'row', gap:2 },
  seg:    { flex:1, height:5, backgroundColor:'rgba(255,255,255,0.1)' },
  segOn:  { backgroundColor:'rgba(255,255,255,0.75)' },
});
