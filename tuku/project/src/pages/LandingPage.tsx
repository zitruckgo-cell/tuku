import { ArrowRight, Truck, Package, MapPin, Shield, Clock, Star, Users, ChevronDown, Lock, Radio } from 'lucide-react';
import { useRouter } from '../contexts/RouterContext';

const HOW_SHIPPER = [
  { step: '01', title: 'Post Your Load', desc: 'Describe what needs delivering — location, item type, your price.' },
  { step: '02', title: 'Drivers Bid', desc: 'Verified tuktuk drivers see your load and submit bids.' },
  { step: '03', title: 'Award & Track', desc: 'Pick the best bid, then track your delivery in real-time to the door.' },
];

const HOW_DRIVER = [
  { step: '01', title: 'Browse Loads', desc: 'See all open deliveries available across Uganda.' },
  { step: '02', title: 'Bid or Accept', desc: 'Submit your price and ETA, or accept loads at the offered rate.' },
  { step: '03', title: 'Deliver & Earn', desc: 'Complete deliveries, upload proof of delivery, and get paid fast.' },
];

const CARGO_TYPES = [
  { icon: '🧪', label: 'Lab Specimens' },
  { icon: '💊', label: 'Medication' },
  { icon: '🏥', label: 'Medical Supplies' },
  { icon: '📄', label: 'Documents' },
  { icon: '📦', label: 'General Cargo' },
];

export function LandingPage() {
  const { navigate } = useRouter();

  return (
    <div className="bg-[#030F0D] text-white">
      {/* Fixed Top Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#030F0D]/90 backdrop-blur-md border-b border-teal-900/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-2.5">
            <img src="/trucgo-logo-transparent.webp" alt="ZITRUCKGO LOGISTICS" className="w-11 h-11 rounded-full object-cover ring-1 ring-teal-500/30" />
            <div className="leading-tight">
              <span className="text-white font-bold text-lg tracking-tight">ZITRUCKGO</span>
              <span className="block text-teal-400 text-[10px] font-semibold uppercase tracking-[0.18em]">Logistics</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/auth', { mode: 'login' })}
              className="text-slate-300 hover:text-white text-sm transition-colors px-3 py-1.5"
            >
              Log In
            </button>
            <button
              onClick={() => navigate('/auth', { mode: 'register' })}
              className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold rounded-lg transition-all hover:shadow-lg hover:shadow-teal-500/25"
            >
              Get Started
            </button>
            <button
              onClick={() => navigate('/admin')}
              className="px-4 py-2 bg-slate-800/80 hover:bg-slate-700 text-teal-300 text-sm font-semibold rounded-lg border border-teal-700/50 transition-all flex items-center gap-1.5"
            >
              <Lock size={14} />
              ADMIN DASHBOARD LOGIN
            </button>
            <button
              onClick={() => navigate('/dispatch')}
              className="px-4 py-2 bg-slate-800/80 hover:bg-slate-700 text-orange-300 text-sm font-semibold rounded-lg border border-orange-700/50 transition-all flex items-center gap-1.5"
            >
              <Radio size={14} />
              DISPATCH DASHBOARD LOGIN
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
        <div className="absolute inset-0 teal-grid" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#030F0D]/50 to-[#030F0D]" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-teal-500/8 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-20 w-full">
          {/* Top badge */}
          <div className="flex justify-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-sm font-medium">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              Uganda's #1 Tuktuk Network
            </div>
          </div>

          {/* Main headline */}
          <div className="text-center mb-14">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight mb-6">
              Welcome to{' '}
              <span className="teal-text-gradient">ZITRUCKGO LOGISTICS</span>
            </h1>
            <p className="text-slate-400 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed">
              Connecting shippers with verified tuktuk drivers across Uganda for fast, affordable small-cargo delivery.
              From lab specimens to documents — dispatched in minutes.
            </p>
          </div>

          {/* Side-by-side Shipper / Driver cards */}
          <div className="grid lg:grid-cols-2 gap-6 max-w-4xl mx-auto mb-16">
            {/* Shipper card */}
            <div className="group relative overflow-hidden rounded-2xl border border-teal-800/40 bg-[#0a2420] p-8 hover:border-teal-600/60 transition-all hover:shadow-xl hover:shadow-teal-900/50">
              <div className="absolute top-0 right-0 w-40 h-40 bg-teal-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-teal-500/15 border border-teal-500/20 flex items-center justify-center mb-5">
                  <Package size={26} className="text-teal-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">I'm a Shipper</h2>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                  Post loads, receive competitive bids from drivers, and track every delivery in real-time until it reaches its destination.
                </p>
                <ul className="space-y-2 mb-8">
                  {HOW_SHIPPER.map((s) => (
                    <li key={s.step} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center mt-0.5">
                        <span className="text-teal-400 text-[10px] font-bold">{s.step.replace('0', '')}</span>
                      </span>
                      <div>
                        <span className="text-white text-sm font-medium">{s.title}</span>
                        <span className="text-slate-500 text-sm"> — {s.desc}</span>
                      </div>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => navigate('/auth', { mode: 'register', role: 'shipper' })}
                  className="group/btn w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-teal-500 hover:bg-teal-400 text-white font-semibold rounded-xl transition-all hover:shadow-lg hover:shadow-teal-500/25"
                >
                  <Package size={18} />
                  Start Shipping
                  <ArrowRight size={16} className="group-hover/btn:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>

            {/* Driver card */}
            <div className="group relative overflow-hidden rounded-2xl border border-teal-800/40 bg-[#0a2420] p-8 hover:border-teal-600/60 transition-all hover:shadow-xl hover:shadow-teal-900/50">
              <div className="absolute top-0 right-0 w-40 h-40 bg-teal-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-teal-500/15 border border-teal-500/20 flex items-center justify-center mb-5">
                  <Truck size={26} className="text-teal-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">I'm a Driver</h2>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                  Browse available loads near you, submit bids, and earn daily on your own schedule with your tuktuk.
                </p>
                <ul className="space-y-2 mb-8">
                  {HOW_DRIVER.map((s) => (
                    <li key={s.step} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center mt-0.5">
                        <span className="text-teal-400 text-[10px] font-bold">{s.step.replace('0', '')}</span>
                      </span>
                      <div>
                        <span className="text-white text-sm font-medium">{s.title}</span>
                        <span className="text-slate-500 text-sm"> — {s.desc}</span>
                      </div>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => navigate('/auth', { mode: 'register', role: 'driver' })}
                  className="group/btn w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-[#0d2e29] hover:bg-teal-900/60 border border-teal-700/50 hover:border-teal-600/80 text-teal-300 font-semibold rounded-xl transition-all"
                >
                  <Truck size={18} />
                  Start Driving
                  <ArrowRight size={16} className="group-hover/btn:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          </div>

          {/* Already have an account */}
          <p className="text-center text-slate-500 text-sm">
            Already have an account?{' '}
            <button
              onClick={() => navigate('/auth', { mode: 'login' })}
              className="text-teal-400 hover:text-teal-300 font-medium transition-colors"
            >
              Log in here
            </button>
          </p>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-teal-900 animate-bounce">
          <ChevronDown size={20} />
        </div>
      </section>

      {/* Cargo types */}
      <section className="py-16 border-y border-teal-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <p className="text-slate-500 text-center text-xs uppercase tracking-widest mb-8">We Handle</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {CARGO_TYPES.map((c) => (
              <div key={c.label} className="flex items-center gap-2.5 px-5 py-2.5 bg-[#0a2420] border border-teal-900/40 rounded-full hover:border-teal-700/60 transition-colors">
                <span className="text-xl">{c.icon}</span>
                <span className="text-slate-300 text-sm font-medium">{c.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Built for Uganda</h2>
            <p className="text-slate-400 max-w-lg mx-auto">Every feature is designed around how deliveries actually work across Uganda's cities and towns.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: MapPin, title: 'Live GPS Tracking', desc: 'Watch your driver move in real-time from pickup to delivery on an interactive map.', color: 'text-teal-400', bg: 'bg-teal-500/10 border-teal-500/20' },
              { icon: Clock, title: 'Fast Dispatch', desc: 'Tuktuks navigate Uganda\'s roads efficiently. Most city deliveries completed quickly.', color: 'text-teal-300', bg: 'bg-teal-400/10 border-teal-400/20' },
              { icon: Shield, title: 'Verified Drivers', desc: 'All drivers are ID-verified with National ID, LC letter, and vehicle registration on file.', color: 'text-teal-400', bg: 'bg-teal-500/10 border-teal-500/20' },
              { icon: Star, title: 'Competitive Bidding', desc: 'Get the best price by letting drivers compete for your load with transparent bids.', color: 'text-teal-300', bg: 'bg-teal-400/10 border-teal-400/20' },
              { icon: Package, title: 'Proof of Delivery', desc: 'Digital POD with recipient signature and photo confirmation every time.', color: 'text-teal-400', bg: 'bg-teal-500/10 border-teal-500/20' },
              { icon: Users, title: 'Dispatcher Support', desc: 'A ZITRUCKGO dispatcher monitors every active haul to intervene if needed.', color: 'text-teal-300', bg: 'bg-teal-400/10 border-teal-400/20' },
            ].map((f, i) => (
              <div key={i} className="card p-6 hover:border-teal-600/40 transition-all group">
                <div className={`w-12 h-12 rounded-xl border ${f.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <f.icon size={22} className={f.color} />
                </div>
                <h3 className="text-white font-semibold mb-2">{f.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 border-t border-teal-900/30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-4xl font-bold mb-4">Ready to get started?</h2>
          <p className="text-slate-400 text-lg mb-10">Join shippers and drivers already using ZITRUCKGO LOGISTICS across Uganda.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/auth', { mode: 'register', role: 'shipper' })}
              className="px-8 py-4 bg-teal-500 hover:bg-teal-400 text-white font-semibold rounded-xl transition-all hover:shadow-xl hover:shadow-teal-500/20"
            >
              Post a Load Now
            </button>
            <button
              onClick={() => navigate('/auth', { mode: 'register', role: 'driver' })}
              className="px-8 py-4 bg-[#0a2420] hover:bg-[#0d2e29] border border-teal-800/50 hover:border-teal-700/60 text-white font-semibold rounded-xl transition-all"
            >
              Register as Driver
            </button>
          </div>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/admin')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800/60 hover:bg-slate-700/70 text-teal-300 font-semibold rounded-xl border border-teal-700/50 hover:border-teal-600 transition-all"
            >
              <Lock size={16} />
              ADMIN DASHBOARD LOGIN
            </button>
            <button
              onClick={() => navigate('/dispatch')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800/60 hover:bg-slate-700/70 text-orange-300 font-semibold rounded-xl border border-orange-700/50 hover:border-orange-600 transition-all"
            >
              <Radio size={16} />
              DISPATCH DASHBOARD LOGIN
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-teal-900/30 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src="/trucgo-logo-transparent.webp" alt="ZITRUCKGO LOGISTICS" className="w-8 h-8 rounded-full object-cover ring-1 ring-teal-500/30" />
            <span className="text-slate-400 text-sm">ZITRUCKGO LOGISTICS · Uganda</span>
          </div>
          <p className="text-slate-600 text-xs">© 2026 ZITRUCKGO LOGISTICS. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
