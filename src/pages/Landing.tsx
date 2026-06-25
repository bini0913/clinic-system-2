import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useSettings } from "@/lib/settings";
import {
  Stethoscope,
  UserPlus,
  FlaskConical,
  Syringe,
  Pill,
  CheckCircle2,
  ShieldCheck,
  Zap,
  CreditCard,
  ListOrdered,
  Printer,
  MonitorPlay,
  ArrowRight,
} from "lucide-react";

const styles = `
.landing { font-family: 'Inter', system-ui, sans-serif; background:#070C18; color:#F0F6FF; }
.landing .display-font { font-family: 'Playfair Display', Georgia, serif; }
.landing .dot-grid {
  background-image: radial-gradient(rgba(14,165,233,0.18) 1px, transparent 1px);
  background-size: 32px 32px;
}
.landing .orb { position:absolute; border-radius:9999px; filter: blur(96px); pointer-events:none; }
.landing .orb-blue { background:#0EA5E9; }
.landing .orb-teal { background:#0D9488; }
.landing .feature-card { transition: transform .35s ease, border-color .35s ease, background .35s ease; }
.landing .feature-card:hover { transform: translateY(-4px); border-color: rgba(14,165,233,0.45); background:#101a30; }
.landing .flow-line { position:relative; height:2px; background-image: linear-gradient(to right, rgba(14,165,233,.4) 50%, transparent 50%); background-size: 12px 2px; }
.landing .flow-dot { position:absolute; top:50%; width:10px; height:10px; border-radius:9999px; background:#0EA5E9; box-shadow:0 0 16px #0EA5E9; transform:translateY(-50%); }
.landing .reveal { opacity:0; transform: translateY(24px); transition: opacity .7s ease, transform .7s ease; }
.landing .reveal.in { opacity:1; transform: translateY(0); }

@media (prefers-reduced-motion: no-preference) {
  .landing .fade-up { opacity:0; transform: translateY(16px); animation: landingFadeUp .8s ease forwards; }
  .landing .float-slow { animation: landingFloat 14s ease-in-out infinite; }
  .landing .float-slower { animation: landingFloat 20s ease-in-out infinite reverse; }
  .landing .pulse-glow { animation: landingPulseGlow 6s ease-in-out infinite; }
  .landing .flow-dot { animation: landingDotTravel 3.2s linear infinite; }
  .landing .navbar-in { animation: landingNavIn .7s ease forwards; }
}

@keyframes landingFadeUp { to { opacity:1; transform: translateY(0); } }
@keyframes landingFloat { 0%,100% { transform: translate(0,0); } 50% { transform: translate(20px,-30px); } }
@keyframes landingPulseGlow { 0%,100% { opacity:.15; } 50% { opacity:.28; } }
@keyframes landingDotTravel { 0% { left:-4%; opacity:0; } 8% { opacity:1; } 92% { opacity:1; } 100% { left:104%; opacity:0; } }
@keyframes landingNavIn { from { opacity:0; transform: translateY(-12px); } to { opacity:1; transform: translateY(0); } }
`;

const flowSteps = [
  { name: "Reception", desc: "Patient registered, card issued, fee collected", color: "#0EA5E9", Icon: UserPlus },
  { name: "OPD", desc: "Doctor examines, assigns services & prescriptions", color: "#8B5CF6", Icon: Stethoscope },
  { name: "Laboratory", desc: "Tests performed, results recorded", color: "#F59E0B", Icon: FlaskConical },
  { name: "Treatment", desc: "Procedures administered", color: "#EF4444", Icon: Syringe },
  { name: "Pharmacy", desc: "Medicines dispensed, visit completed", color: "#10B981", Icon: Pill },
];

const features = [
  { Icon: ShieldCheck, color: "#0EA5E9", title: "Role-Based Access", desc: "6 specialized roles: Reception, OPD, Lab, Treatment, Pharmacy & Admin." },
  { Icon: Zap, color: "#F59E0B", title: "Real-Time Queues", desc: "Supabase Realtime keeps every room's queue updated instantly — no refresh needed." },
  { Icon: CreditCard, color: "#10B981", title: "Smart Payments", desc: "Cash and bank transfer support with Telebirr, CBE, Awash, Dashen & more." },
  { Icon: ListOrdered, color: "#8B5CF6", title: "Sequential Workflow", desc: "Doctor sets the service order. Patients flow through rooms automatically." },
  { Icon: Printer, color: "#EF4444", title: "Print Everything", desc: "Patient cards, receipts, prescriptions, and lab reports — all print-ready." },
  { Icon: MonitorPlay, color: "#0D9488", title: "Queue Display", desc: "Public TV screen shows token numbers for each room — no crowding, no shouting." },
];

function useReveal() {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const els = root.querySelectorAll<HTMLElement>(".reveal");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e, i) => {
          if (e.isIntersecting) {
            const el = e.target as HTMLElement;
            const delay = Number(el.dataset.delay ?? i * 80);
            setTimeout(() => el.classList.add("in"), delay);
            io.unobserve(el);
          }
        });
      },
      { threshold: 0.15 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return ref;
}

export default function Landing() {
  const { settings } = useSettings();
  const clinicName = settings.clinic_name || "Clinic OS";
  const rootRef = useReveal();

  return (
    <div ref={rootRef} className="landing min-h-screen overflow-x-hidden">
      <style dangerouslySetInnerHTML={{ __html: styles }} />

      {/* NAVBAR */}
      <nav className="navbar-in fixed top-0 inset-x-0 z-50 backdrop-blur-md bg-slate-950/70 border-b border-slate-800/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-sky-500 to-teal-500 shadow-lg shadow-sky-500/20">
              <Stethoscope className="w-5 h-5 text-white" />
            </span>
            <span className="font-semibold tracking-tight text-[15px]">{clinicName}</span>
          </Link>
          <Link
            to="/login"
            className="px-4 py-2 text-sm rounded-full border border-sky-500/40 text-sky-200 hover:bg-sky-500/10 hover:border-sky-400 transition"
          >
            Sign In
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative min-h-screen flex items-center justify-center px-6 pt-24 overflow-hidden">
        <div className="absolute inset-0 dot-grid opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
        <div className="orb orb-blue pulse-glow float-slow" style={{ width: 520, height: 520, top: "-120px", left: "-120px", opacity: 0.18 }} />
        <div className="orb orb-teal pulse-glow float-slower" style={{ width: 600, height: 600, bottom: "-180px", right: "-160px", opacity: 0.13 }} />

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="fade-up inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-sky-500/30 bg-sky-500/5 text-xs uppercase tracking-[0.18em] text-sky-300" style={{ animationDelay: "0ms" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" /> Modern Healthcare Operations
          </div>
          <h1 className="fade-up display-font mt-8 text-5xl md:text-7xl font-bold leading-[1.05] tracking-tight" style={{ animationDelay: "120ms" }}>
            From Registration<br />
            <span className="bg-gradient-to-r from-sky-300 via-sky-400 to-teal-300 bg-clip-text text-transparent">to Recovery,</span><br />
            Seamlessly.
          </h1>
          <p className="fade-up mt-7 text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed" style={{ animationDelay: "240ms" }}>
            A complete clinic management system that connects your reception, doctors, lab, treatment room, and pharmacy in one real-time workflow.
          </p>
          <div className="fade-up mt-10 flex flex-col sm:flex-row gap-3 items-center justify-center" style={{ animationDelay: "360ms" }}>
            <Link
              to="/login"
              className="group inline-flex items-center gap-2 px-8 py-3 rounded-full bg-sky-500 hover:bg-sky-400 text-white font-medium shadow-lg shadow-sky-500/30 transition"
            >
              Get Started <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              to="/display"
              className="inline-flex items-center gap-2 px-8 py-3 rounded-full text-slate-200 hover:text-white hover:bg-white/5 border border-transparent hover:border-slate-700 transition"
            >
              View Live Queue <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* PATIENT FLOW */}
      <section className="relative px-6 py-28 border-t border-slate-900">
        <div className="max-w-7xl mx-auto">
          <div className="reveal text-center max-w-2xl mx-auto mb-16">
            <div className="text-xs uppercase tracking-[0.18em] text-sky-400 mb-3">The Patient Journey</div>
            <h2 className="display-font text-4xl md:text-5xl font-semibold leading-tight">One workflow. Five rooms. Zero confusion.</h2>
            <p className="mt-4 text-slate-400">Every patient flows through the clinic on a path the doctor controls — and every screen knows where they are right now.</p>
          </div>

          {/* Desktop flow */}
          <div className="hidden lg:flex items-stretch gap-3">
            {flowSteps.map((s, i) => (
              <div key={s.name} className="flex items-stretch flex-1">
                <div
                  className="reveal feature-card flex-1 rounded-2xl bg-[#0D1425] border border-sky-500/10 p-5"
                  data-delay={i * 120}
                  style={{ borderLeft: `3px solid ${s.color}` }}
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg mb-4" style={{ background: `${s.color}1f`, color: s.color }}>
                    <s.Icon className="w-5 h-5" />
                  </div>
                  <div className="font-semibold text-[15px]">{s.name}</div>
                  <div className="text-sm text-slate-400 mt-1.5 leading-relaxed">{s.desc}</div>
                </div>
                {i < flowSteps.length - 1 && (
                  <div className="flex items-center w-10 shrink-0">
                    <div className="flow-line w-full">
                      <span className="flow-dot" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Mobile flow */}
          <div className="lg:hidden space-y-3">
            {flowSteps.map((s, i) => (
              <div
                key={s.name}
                className="reveal feature-card rounded-2xl bg-[#0D1425] border border-sky-500/10 p-5"
                data-delay={i * 100}
                style={{ borderLeft: `3px solid ${s.color}` }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg" style={{ background: `${s.color}1f`, color: s.color }}>
                    <s.Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-[15px]">{s.name}</div>
                    <div className="text-sm text-slate-400 mt-0.5">{s.desc}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="relative px-6 py-28 border-t border-slate-900">
        <div className="max-w-7xl mx-auto">
          <div className="reveal text-center max-w-2xl mx-auto mb-16">
            <div className="text-xs uppercase tracking-[0.18em] text-sky-400 mb-3">Built for daily clinic life</div>
            <h2 className="display-font text-4xl md:text-5xl font-semibold leading-tight">Everything your team needs. Nothing they don't.</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <div
                key={f.title}
                className="reveal feature-card rounded-2xl p-6 bg-[#0D1425] border border-sky-500/10"
                data-delay={i * 80}
              >
                <div className="flex items-center justify-center w-11 h-11 rounded-xl mb-5" style={{ background: `${f.color}1f`, color: f.color }}>
                  <f.Icon className="w-5 h-5" />
                </div>
                <div className="font-semibold text-[16px]">{f.title}</div>
                <div className="text-sm text-slate-400 mt-2 leading-relaxed">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="relative border-y border-slate-900 bg-[#0A1120]">
        <div className="max-w-7xl mx-auto px-6 py-16 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { v: "6", l: "Specialized Roles" },
            { v: "13", l: "Service Types" },
            { v: "Live", l: "Real-Time Updates" },
            { v: "0", l: "Downtime" },
          ].map((s, i) => (
            <div key={s.l} className="reveal" data-delay={i * 80}>
              <div className="display-font text-5xl md:text-6xl font-semibold bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">{s.v}</div>
              <div className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative px-6 py-32 overflow-hidden">
        <div className="orb orb-blue pulse-glow float-slow" style={{ width: 500, height: 500, top: "-160px", left: "10%", opacity: 0.14 }} />
        <div className="orb orb-teal pulse-glow float-slower" style={{ width: 480, height: 480, bottom: "-180px", right: "10%", opacity: 0.12 }} />
        <div className="relative max-w-3xl mx-auto text-center">
          <div className="reveal inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-teal-500 mb-6 shadow-xl shadow-sky-500/30">
            <CheckCircle2 className="w-7 h-7 text-white" />
          </div>
          <h2 className="reveal display-font text-4xl md:text-6xl font-semibold leading-tight">Ready to modernize your clinic?</h2>
          <p className="reveal mt-5 text-lg text-slate-400">Sign in and start managing patients in minutes.</p>
          <div className="reveal mt-9">
            <Link
              to="/login"
              className="group inline-flex items-center gap-2 px-9 py-3.5 rounded-full bg-sky-500 hover:bg-sky-400 text-white font-medium shadow-lg shadow-sky-500/30 transition"
            >
              Sign In to Dashboard <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-900">
        <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-gradient-to-br from-sky-500 to-teal-500">
              <Stethoscope className="w-4 h-4 text-white" />
            </span>
            <span className="font-medium text-slate-300">{clinicName}</span>
          </div>
          <div className="text-slate-500">Built for modern clinics</div>
          <div>© {new Date().getFullYear()} {clinicName}. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}