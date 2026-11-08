import { useState } from 'react';
import { Truck, Package, Eye, EyeOff, ArrowLeft, CheckCircle, CreditCard, MapPin, FileText, MessageSquare, ArrowRight, Shield, User, Building2, Lock, Radio } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from '../contexts/RouterContext';

type Mode = 'login' | 'register';
type Role = 'shipper' | 'driver';
type AccountType = 'individual' | 'business';
type DriverStep = 'account' | 'address' | 'vehicle' | 'documents';

const DRIVER_STEPS: { key: DriverStep; label: string; icon: React.ElementType }[] = [
  { key: 'account', label: 'Account', icon: Truck },
  { key: 'address', label: 'Address', icon: MapPin },
  { key: 'vehicle', label: 'Vehicle', icon: Truck },
  { key: 'documents', label: 'Documents', icon: FileText },
];

const UGANDA_DISTRICTS = [
  'Kampala', 'Wakiso', 'Mukono', 'Entebbe', 'Luwero', 'Mpigi', 'Butebo',
  'Gulu', 'Mbarara', 'Jinja', 'Mbale', 'Masaka', 'Fort Portal', 'Kabale',
  'Lira', 'Soroti', 'Arua', 'Hoima', 'Masindi', 'Tororo', 'Other',
];

export function AuthPage({ adminMode, dispatchMode }: { adminMode?: boolean; dispatchMode?: boolean }) {
  const { navigate, params } = useRouter();
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<Mode>(adminMode || dispatchMode ? 'login' : ((params.mode as Mode) || 'login'));
  const [role, setRole] = useState<Role>((params.role as Role) || 'shipper');
  const [roleChosen, setRoleChosen] = useState<boolean>(!!params.role);
  const [accountType, setAccountType] = useState<AccountType>('individual');
  const [businessName, setBusinessName] = useState('');
  const [driverStep, setDriverStep] = useState<DriverStep>('account');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Account fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  // Address fields (Ugandan format)
  const [village, setVillage] = useState('');
  const [parish, setParish] = useState('');
  const [subcounty, setSubcounty] = useState('');
  const [district, setDistrict] = useState('');

  // Vehicle fields
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');

  // Document fields
  const [nationalId, setNationalId] = useState('');
  const [lcLetterRef, setLcLetterRef] = useState('');
  const [referralRef, setReferralRef] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');

  function clearError() { setError(''); }

  function validateDriverStep(): string | null {
    if (driverStep === 'account') {
      if (!fullName.trim()) return 'Full name is required.';
      if (!phone.trim()) return 'Phone number is required.';
      if (!email.trim()) return 'Email address is required.';
      if (password.length < 6) return 'Password must be at least 6 characters.';
    }
    if (driverStep === 'address') {
      if (!village.trim()) return 'Village / Zone is required.';
      if (!parish.trim()) return 'Parish is required.';
      if (!subcounty.trim()) return 'Sub-county / Division is required.';
      if (!district) return 'District is required.';
    }
    if (driverStep === 'vehicle') {
      if (!vehiclePlate.trim()) return 'Tukutuku number plate is required.';
    }
    if (driverStep === 'documents') {
      if (!nationalId.trim()) return 'National ID number is required.';
      if (!lcLetterRef.trim()) return 'LC letter reference / LC Chairman name is required.';
    }
    return null;
  }

  function nextDriverStep() {
    const err = validateDriverStep();
    if (err) { setError(err); return; }
    setError('');
    const steps: DriverStep[] = ['account', 'address', 'vehicle', 'documents'];
    const idx = steps.indexOf(driverStep);
    if (idx < steps.length - 1) setDriverStep(steps[idx + 1]);
  }

  function prevDriverStep() {
    const steps: DriverStep[] = ['account', 'address', 'vehicle', 'documents'];
    const idx = steps.indexOf(driverStep);
    if (idx > 0) setDriverStep(steps[idx - 1]);
    setError('');
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { error, profile: prof } = await signIn(email, password);
      if (error) { setError(error); setLoading(false); return; }
      if (prof) {
        if (prof.role === 'admin') navigate('/admin');
        else if (prof.role === 'dispatcher') navigate('/dispatch');
        else if (prof.role === 'driver') navigate('/driver');
        else navigate('/shipper');
      }
      else setLoading(false);
    } catch (err: any) {
      setError(err?.message || 'Sign in failed. Please try again.');
      setLoading(false);
    }
  }

  async function handleShipperRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) { setError('Full name is required.'); return; }
    if (accountType === 'business' && !businessName.trim()) { setError('Business name is required.'); return; }
    if (!phone.trim()) { setError('Phone number is required.'); return; }
    setLoading(true);
    setError('');
    try {
      const { error, profile: prof } = await signUp(email, password, {
        full_name: fullName.trim(),
        phone: phone.trim(),
        role: 'shipper',
        account_type: accountType,
        business_name: accountType === 'business' ? businessName.trim() : undefined,
        is_available: false,
      } as any);
      if (error) { setError(error); setLoading(false); return; }
      if (prof) navigate('/shipper');
      else setLoading(false);
    } catch (err: any) {
      setError(err?.message || 'Sign up failed. Please try again.');
      setLoading(false);
    }
  }

  async function handleDriverRegister() {
    const err = validateDriverStep();
    if (err) { setError(err); return; }
    if (accountType === 'business' && !businessName.trim()) { setError('Business name is required.'); return; }
    setLoading(true);
    setError('');
    try {
      const { error, profile: prof } = await signUp(email, password, {
        full_name: fullName.trim(),
        phone: phone.trim(),
        role: 'driver',
        account_type: accountType,
        business_name: accountType === 'business' ? businessName.trim() : undefined,
        vehicle_plate: vehiclePlate.trim(),
        vehicle_model: vehicleModel.trim() || undefined,
        address_village: village.trim(),
        address_parish: parish.trim(),
        address_subcounty: subcounty.trim(),
        address_district: district,
        national_id_number: nationalId.trim(),
        lc_letter_ref: lcLetterRef.trim(),
        referral_letter_ref: referralRef.trim() || undefined,
        special_instructions: specialInstructions.trim() || undefined,
        is_available: true,
      } as any);
      if (error) { setError(error); setLoading(false); return; }
      if (prof) navigate('/driver');
      else setLoading(false);
    } catch (err: any) {
      setError(err?.message || 'Sign up failed. Please try again.');
      setLoading(false);
    }
  }

  const driverStepIndex = ['account', 'address', 'vehicle', 'documents'].indexOf(driverStep);
  const isLastDriverStep = driverStep === 'documents';

  return (
    <div className="min-h-screen bg-[#030F0D] flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-5/12 relative bg-[#04120f] items-center justify-center p-12 overflow-hidden">
        <div className="absolute inset-0 teal-grid" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-teal-500/8 rounded-full blur-3xl" />
        <div className="relative text-center max-w-sm">
          <img src="/trucgo-logo-transparent.webp" alt="ZITRUCKGO LOGISTICS" className="w-24 h-24 rounded-full object-cover ring-2 ring-teal-500/30 mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-white mb-1">ZITRUCKGO</h1>
          <p className="text-teal-400 text-sm font-semibold uppercase tracking-[0.2em] mb-3">Logistics</p>
          <p className="text-slate-400 text-lg mb-8">Uganda's #1 Tuktuk Network</p>
          <div className="space-y-3 text-left">
            {[
              'Post urgent deliveries in seconds',
              'Real-time GPS tracking per haul',
              'Verified drivers across Uganda',
              'Digital proof of delivery',
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <CheckCircle size={16} className="text-teal-400 flex-shrink-0" />
                <span className="text-slate-300 text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="w-full lg:w-7/12 flex flex-col items-center justify-center p-6 sm:p-10 overflow-y-auto">
        <div className="w-full max-w-xl">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6 transition-colors">
            <ArrowLeft size={16} /> Back to home
          </button>

          {/* Mode toggle */}
          {adminMode || dispatchMode ? (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-1">
                {adminMode ? <Lock size={18} className="text-teal-400" /> : <Radio size={18} className="text-orange-400" />}
                <h2 className="text-2xl font-bold text-white">{adminMode ? 'Admin Access' : 'Dispatcher Access'}</h2>
              </div>
              <p className="text-slate-400 text-sm">Sign in with your {adminMode ? 'admin' : 'dispatcher'} credentials.</p>
            </div>
          ) : (
          <div className="flex bg-[#0a2420] border border-teal-900/40 rounded-xl p-1 mb-6">
            {(['login', 'register'] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); setDriverStep('account'); if (m === 'register') setRoleChosen(false); }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  mode === m ? 'bg-teal-800/60 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                {m === 'login' ? 'Log In' : 'Create Account'}
              </button>
            ))}
          </div>
          )}

          {/* ── LOGIN ── */}
          {mode === 'login' && (
            <>
              <h2 className="text-2xl font-bold text-white mb-1">Welcome back</h2>
              <p className="text-slate-400 text-sm mb-6">Sign in to your dispatch account.</p>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1.5">Account Type</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => { setAccountType('individual'); clearError(); }}
                      className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${accountType === 'individual' ? 'bg-teal-500/15 border-teal-500 text-teal-300' : 'bg-[#0a2420] border-teal-900/50 text-slate-400 hover:border-teal-700'}`}>
                      <User size={16} /> Individual
                    </button>
                    <button type="button" onClick={() => { setAccountType('business'); clearError(); }}
                      className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${accountType === 'business' ? 'bg-teal-500/15 border-teal-500 text-teal-300' : 'bg-[#0a2420] border-teal-900/50 text-slate-400 hover:border-teal-700'}`}>
                      <Building2 size={16} /> Business
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1.5">Email Address</label>
                  <input type="email" value={email} onChange={e => { setEmail(e.target.value); clearError(); }} placeholder="you@example.com" required
                    className="w-full bg-[#0a2420] border border-teal-900/50 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1.5">Password</label>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => { setPassword(e.target.value); clearError(); }} placeholder="Your password" required
                      className="w-full bg-[#0a2420] border border-teal-900/50 text-white placeholder-slate-500 rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:border-teal-500 transition-colors" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>}
                <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl font-semibold text-white bg-teal-500 hover:bg-teal-400 disabled:bg-teal-500/50 disabled:cursor-not-allowed transition-all">
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>

              {/* Admin Login Divider */}
              {!adminMode && !dispatchMode && (
              <>
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-teal-900/40" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-[#0a1f1c] px-3 text-slate-500 text-xs uppercase tracking-wider">or</span>
                </div>
              </div>

              {/* Admin Dashboard Login Button */}
              <button
                onClick={() => navigate('/admin')}
                className="w-full py-3.5 rounded-xl font-semibold text-teal-300 bg-teal-900/20 hover:bg-teal-900/40 border border-teal-700/50 hover:border-teal-600 transition-all flex items-center justify-center gap-2 group"
              >
                <Lock size={18} className="text-teal-400 group-hover:scale-110 transition-transform" />
                ADMIN DASHBOARD LOGIN
              </button>
              </>
              )}
            </>
          )}

          {/* ── REGISTER ── */}
          {mode === 'register' && !adminMode && !dispatchMode && (
            <>
              {/* ── ROLE SELECTION SCREEN ── */}
              {!roleChosen ? (
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">How will you use ZITRUCKGO?</h2>
                  <p className="text-slate-400 text-sm mb-8">Choose your role to get started. You can always update your profile later.</p>

                  <div className="grid grid-cols-2 gap-4 mb-8">
                    {/* Driver card */}
                    <button
                      onClick={() => { setRole('driver'); setRoleChosen(true); setDriverStep('account'); setError(''); }}
                      className="group relative overflow-hidden rounded-2xl border-2 border-teal-900/40 bg-[#0a2420] p-6 text-left hover:border-teal-500/70 hover:bg-teal-900/20 transition-all duration-200 hover:shadow-xl hover:shadow-teal-900/40 hover:-translate-y-0.5"
                    >
                      <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/5 rounded-full blur-xl -translate-y-1/2 translate-x-1/2" />
                      <div className="relative">
                        <div className="w-14 h-14 rounded-2xl bg-teal-500/15 border border-teal-500/25 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                          <Truck size={26} className="text-teal-400" />
                        </div>
                        <p className="text-white font-bold text-lg mb-1">Driver</p>
                        <p className="text-slate-400 text-xs leading-relaxed mb-4">Find loads, bid, and earn daily with your tuktuk.</p>
                        <ul className="space-y-1.5 mb-5">
                          {['Browse open loads', 'Submit bids & earn', 'GPS-tracked hauls'].map(f => (
                            <li key={f} className="flex items-center gap-2 text-xs text-slate-400">
                              <CheckCircle size={11} className="text-teal-500 flex-shrink-0" />
                              {f}
                            </li>
                          ))}
                        </ul>
                        <span className="inline-flex items-center gap-1.5 text-teal-400 text-xs font-semibold group-hover:gap-2.5 transition-all">
                          Start as Driver <ArrowRight size={13} />
                        </span>
                      </div>
                    </button>

                    {/* Shipper card */}
                    <button
                      onClick={() => { setRole('shipper'); setRoleChosen(true); setError(''); }}
                      className="group relative overflow-hidden rounded-2xl border-2 border-teal-900/40 bg-[#0a2420] p-6 text-left hover:border-teal-500/70 hover:bg-teal-900/20 transition-all duration-200 hover:shadow-xl hover:shadow-teal-900/40 hover:-translate-y-0.5"
                    >
                      <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/5 rounded-full blur-xl -translate-y-1/2 translate-x-1/2" />
                      <div className="relative">
                        <div className="w-14 h-14 rounded-2xl bg-teal-500/15 border border-teal-500/25 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                          <Package size={26} className="text-teal-400" />
                        </div>
                        <p className="text-white font-bold text-lg mb-1">Shipper</p>
                        <p className="text-slate-400 text-xs leading-relaxed mb-4">Post loads and get them delivered fast across Uganda.</p>
                        <ul className="space-y-1.5 mb-5">
                          {['Post loads instantly', 'Receive driver bids', 'Track deliveries live'].map(f => (
                            <li key={f} className="flex items-center gap-2 text-xs text-slate-400">
                              <CheckCircle size={11} className="text-teal-500 flex-shrink-0" />
                              {f}
                            </li>
                          ))}
                        </ul>
                        <span className="inline-flex items-center gap-1.5 text-teal-400 text-xs font-semibold group-hover:gap-2.5 transition-all">
                          Start as Shipper <ArrowRight size={13} />
                        </span>
                      </div>
                    </button>
                  </div>

                  <div className="flex items-center gap-2 p-3 bg-teal-900/15 border border-teal-900/30 rounded-xl">
                    <Shield size={14} className="text-teal-500 flex-shrink-0" />
                    <p className="text-slate-400 text-xs">All accounts are verified. Driver accounts require ID documents before activation.</p>
                  </div>
                </div>
              ) : (
              <>
              <div className="flex items-center gap-3 mb-5">
                <button
                  onClick={() => { setRoleChosen(false); setError(''); }}
                  className="flex items-center gap-1.5 text-slate-400 hover:text-white text-xs transition-colors"
                >
                  <ArrowLeft size={13} /> Change role
                </button>
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border bg-teal-500/10 text-teal-400 border-teal-500/20`}>
                  {role === 'driver' ? <><Truck size={11} /> Registering as Driver</> : <><Package size={11} /> Registering as Shipper</>}
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white mb-1">Create your account</h2>
              <p className="text-slate-400 text-sm mb-5">Join ZITRUCKGO LOGISTICS — Uganda's Tuktuk Network.</p>

              {/* ── SHIPPER REGISTER ── */}
              {role === 'shipper' && (
                <form onSubmit={handleShipperRegister} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-slate-300 text-sm font-medium mb-1.5">Account Type</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button type="button" onClick={() => { setAccountType('individual'); clearError(); }}
                          className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${accountType === 'individual' ? 'bg-teal-500/15 border-teal-500 text-teal-300' : 'bg-[#0a2420] border-teal-900/50 text-slate-400 hover:border-teal-700'}`}>
                          <User size={16} /> Individual
                        </button>
                        <button type="button" onClick={() => { setAccountType('business'); clearError(); }}
                          className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${accountType === 'business' ? 'bg-teal-500/15 border-teal-500 text-teal-300' : 'bg-[#0a2420] border-teal-900/50 text-slate-400 hover:border-teal-700'}`}>
                          <Building2 size={16} /> Business
                        </button>
                      </div>
                    </div>
                    {accountType === 'business' && (
                      <div className="col-span-2">
                        <label className="block text-slate-300 text-sm font-medium mb-1.5">Business Name</label>
                        <input type="text" value={businessName} onChange={e => { setBusinessName(e.target.value); clearError(); }} placeholder="e.g. Maama Sarah Logistics Ltd" required={accountType === 'business'}
                          className="w-full bg-[#0a2420] border border-teal-900/50 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-500 transition-colors" />
                      </div>
                    )}
                    <div className="col-span-2">
                      <label className="block text-slate-300 text-sm font-medium mb-1.5">Full Name</label>
                      <input type="text" value={fullName} onChange={e => { setFullName(e.target.value); clearError(); }} placeholder="e.g. Sarah Namukasa" required
                        className="w-full bg-[#0a2420] border border-teal-900/50 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-500 transition-colors" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-slate-300 text-sm font-medium mb-1.5">Phone Number</label>
                      <input type="tel" value={phone} onChange={e => { setPhone(e.target.value); clearError(); }} placeholder="+256 700 000000" required
                        className="w-full bg-[#0a2420] border border-teal-900/50 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-500 transition-colors" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-slate-300 text-sm font-medium mb-1.5">Email Address</label>
                      <input type="email" value={email} onChange={e => { setEmail(e.target.value); clearError(); }} placeholder="you@example.com" required
                        className="w-full bg-[#0a2420] border border-teal-900/50 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-500 transition-colors" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-slate-300 text-sm font-medium mb-1.5">Password</label>
                      <div className="relative">
                        <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => { setPassword(e.target.value); clearError(); }} placeholder="Minimum 6 characters" required minLength={6}
                          className="w-full bg-[#0a2420] border border-teal-900/50 text-white placeholder-slate-500 rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:border-teal-500 transition-colors" />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>
                  {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>}
                  <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl font-semibold text-white bg-teal-500 hover:bg-teal-400 disabled:bg-teal-500/50 transition-all">
                    {loading ? 'Creating account...' : 'Create Shipper Account'}
                  </button>
                </form>
              )}

              {/* ── DRIVER REGISTER (multi-step) ── */}
              {role === 'driver' && (
                <div>
                  {/* Step indicators */}
                  <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
                    {DRIVER_STEPS.map((s, i) => (
                      <div key={s.key} className="flex items-center">
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0 transition-all ${
                          s.key === driverStep
                            ? 'bg-teal-500 text-white'
                            : i < driverStepIndex
                            ? 'bg-teal-500/20 text-teal-400'
                            : 'bg-[#0a2420] text-slate-500'
                        }`}>
                          {i < driverStepIndex ? <CheckCircle size={12} /> : <span>{i + 1}</span>}
                          {s.label}
                        </div>
                        {i < DRIVER_STEPS.length - 1 && <div className="w-4 h-px bg-teal-900/50 flex-shrink-0 mx-0.5" />}
                      </div>
                    ))}
                  </div>

                  {/* Progress bar */}
                  <div className="flex gap-1.5 mb-6">
                    {DRIVER_STEPS.map((s, i) => (
                      <div key={s.key} className={`h-1 flex-1 rounded-full transition-all ${i <= driverStepIndex ? 'bg-teal-500' : 'bg-teal-900/40'}`} />
                    ))}
                  </div>

                  {/* Step: Account */}
                  {driverStep === 'account' && (
                    <div className="space-y-4">
                      <SectionHeader icon={Truck} title="Personal Details" />
                      <div>
                        <label className="block text-slate-300 text-sm font-medium mb-1.5">Account Type</label>
                        <div className="grid grid-cols-2 gap-3">
                          <button type="button" onClick={() => { setAccountType('individual'); clearError(); }}
                            className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${accountType === 'individual' ? 'bg-teal-500/15 border-teal-500 text-teal-300' : 'bg-[#0a2420] border-teal-900/50 text-slate-400 hover:border-teal-700'}`}>
                            <User size={16} /> Individual
                          </button>
                          <button type="button" onClick={() => { setAccountType('business'); clearError(); }}
                            className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${accountType === 'business' ? 'bg-teal-500/15 border-teal-500 text-teal-300' : 'bg-[#0a2420] border-teal-900/50 text-slate-400 hover:border-teal-700'}`}>
                            <Building2 size={16} /> Business
                          </button>
                        </div>
                      </div>
                      {accountType === 'business' && (
                        <div>
                          <label className="block text-slate-300 text-sm font-medium mb-1.5">Business Name</label>
                          <input type="text" value={businessName} onChange={e => { setBusinessName(e.target.value); clearError(); }} placeholder="e.g. Speedy Riders Co. Ltd" required={accountType === 'business'}
                            className="w-full bg-[#0a2420] border border-teal-900/50 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-500 transition-colors" />
                        </div>
                      )}
                      <div>
                        <label className="block text-slate-300 text-sm font-medium mb-1.5">Full Name (as on National ID)</label>
                        <input type="text" value={fullName} onChange={e => { setFullName(e.target.value); clearError(); }} placeholder="e.g. Mukama Ssebuliba John"
                          className="w-full bg-[#0a2420] border border-teal-900/50 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-500 transition-colors" />
                      </div>
                      <div>
                        <label className="block text-slate-300 text-sm font-medium mb-1.5">Phone Number (MTN / Airtel)</label>
                        <input type="tel" value={phone} onChange={e => { setPhone(e.target.value); clearError(); }} placeholder="+256 700 000000"
                          className="w-full bg-[#0a2420] border border-teal-900/50 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-500 transition-colors" />
                      </div>
                      <div>
                        <label className="block text-slate-300 text-sm font-medium mb-1.5">Email Address</label>
                        <input type="email" value={email} onChange={e => { setEmail(e.target.value); clearError(); }} placeholder="you@example.com"
                          className="w-full bg-[#0a2420] border border-teal-900/50 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-500 transition-colors" />
                      </div>
                      <div>
                        <label className="block text-slate-300 text-sm font-medium mb-1.5">Password</label>
                        <div className="relative">
                          <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => { setPassword(e.target.value); clearError(); }} placeholder="Minimum 6 characters" minLength={6}
                            className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:border-teal-500 transition-colors" />
                          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step: Address (Ugandan format) */}
                  {driverStep === 'address' && (
                    <div className="space-y-4">
                      <SectionHeader icon={MapPin} title="Home Address" subtitle="Ugandan format — no zip codes or street numbers" />
                      <div className="p-3 bg-teal-500/5 border border-teal-500/20 rounded-xl text-teal-400 text-xs">
                        Your address must match your LC letter. Use the local administrative structure: Village → Parish → Sub-county → District.
                      </div>
                      <div>
                        <label className="block text-slate-300 text-sm font-medium mb-1.5">Village / Zone / Estate <span className="text-red-400">*</span></label>
                        <input type="text" value={village} onChange={e => { setVillage(e.target.value); clearError(); }} placeholder="e.g. Kyanja Zone A, Bukoto Village"
                          className="w-full bg-[#0a2420] border border-teal-900/50 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-500 transition-colors" />
                      </div>
                      <div>
                        <label className="block text-slate-300 text-sm font-medium mb-1.5">Parish <span className="text-red-400">*</span></label>
                        <input type="text" value={parish} onChange={e => { setParish(e.target.value); clearError(); }} placeholder="e.g. Bukoto Parish, Nakawa Parish"
                          className="w-full bg-[#0a2420] border border-teal-900/50 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-500 transition-colors" />
                      </div>
                      <div>
                        <label className="block text-slate-300 text-sm font-medium mb-1.5">Sub-county / Division <span className="text-red-400">*</span></label>
                        <input type="text" value={subcounty} onChange={e => { setSubcounty(e.target.value); clearError(); }} placeholder="e.g. Kawempe Division, Nakawa Division"
                          className="w-full bg-[#0a2420] border border-teal-900/50 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-500 transition-colors" />
                      </div>
                      <div>
                        <label className="block text-slate-300 text-sm font-medium mb-1.5">District <span className="text-red-400">*</span></label>
                        <select value={district} onChange={e => { setDistrict(e.target.value); clearError(); }}
                          className="w-full bg-[#0a2420] border border-teal-900/50 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-500 transition-colors appearance-none">
                          <option value="">Select district...</option>
                          {UGANDA_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Step: Vehicle */}
                  {driverStep === 'vehicle' && (
                    <div className="space-y-4">
                      <SectionHeader icon={Truck} title="Tukutuku Details" subtitle="The vehicle you will use for deliveries" />
                      <div>
                        <label className="block text-slate-300 text-sm font-medium mb-1.5">Number Plate <span className="text-red-400">*</span></label>
                        <input type="text" value={vehiclePlate} onChange={e => { setVehiclePlate(e.target.value.toUpperCase()); clearError(); }} placeholder="e.g. UAX 123A"
                          className="w-full bg-[#0a2420] border border-teal-900/50 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-500 transition-colors font-mono tracking-wider" />
                        <p className="text-slate-500 text-xs mt-1.5">Must match your vehicle registration papers.</p>
                      </div>
                      <div>
                        <label className="block text-slate-300 text-sm font-medium mb-1.5">Tukutuku Model (optional)</label>
                        <input type="text" value={vehicleModel} onChange={e => setVehicleModel(e.target.value)} placeholder="e.g. Bajaj RE, Piaggio Ape, TVS King"
                          className="w-full bg-[#0a2420] border border-teal-900/50 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-500 transition-colors" />
                      </div>
                      <div>
                        <label className="block text-slate-300 text-sm font-medium mb-1.5">
                          <span className="flex items-center gap-1.5">
                            <MessageSquare size={14} className="text-teal-400" />
                            Special Instructions / Short Message (optional)
                          </span>
                        </label>
                        <textarea value={specialInstructions} onChange={e => setSpecialInstructions(e.target.value)} rows={3}
                          placeholder="e.g. Available weekdays 7am–6pm only. Can handle fragile items carefully. Experienced with hospital deliveries."
                          className="w-full bg-[#0a2420] border border-teal-900/50 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-500 transition-colors resize-none" />
                        <p className="text-slate-500 text-xs mt-1.5">This message appears on your driver profile for shippers to see.</p>
                      </div>
                    </div>
                  )}

                  {/* Step: Documents */}
                  {driverStep === 'documents' && (
                    <div className="space-y-4">
                      <SectionHeader icon={CreditCard} title="Verification Documents" subtitle="Required to activate your driver account" />
                      <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-xs leading-relaxed">
                        Physical copies of all documents must be submitted at the ZITRUCKGO LOGISTICS office within 7 days of registration. Your account will be activated once verified.
                      </div>

                      {/* National ID */}
                      <div>
                        <label className="block text-slate-300 text-sm font-medium mb-1.5 flex items-center gap-2">
                          <CreditCard size={15} className="text-teal-400" /> National ID Number <span className="text-red-400">*</span>
                        </label>
                        <input type="text" value={nationalId} onChange={e => { setNationalId(e.target.value.toUpperCase()); clearError(); }}
                          placeholder="e.g. CM90004876ZTWE"
                          className="w-full bg-[#0a2420] border border-teal-900/50 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-500 transition-colors font-mono tracking-wider" />
                        <p className="text-slate-500 text-xs mt-1.5">14-character Uganda National ID number from your card.</p>
                      </div>

                      {/* LC Letter */}
                      <div className="bg-[#0a2420] border border-teal-900/40 rounded-xl p-4 space-y-3">
                        <div className="flex items-center gap-2 mb-1">
                          <FileText size={15} className="text-teal-400" />
                          <p className="text-slate-200 text-sm font-medium">Letter from Local Council (LC1) <span className="text-red-400">*</span></p>
                        </div>
                        <p className="text-slate-500 text-xs leading-relaxed">
                          A signed letter from your LC1 Chairperson confirming your residency in the village/zone above.
                          Must include the LC1 stamp and chairperson's signature.
                        </p>
                        <div>
                          <label className="block text-slate-400 text-xs font-medium mb-1.5">LC1 Chairperson Name / Reference <span className="text-red-400">*</span></label>
                          <input type="text" value={lcLetterRef} onChange={e => { setLcLetterRef(e.target.value); clearError(); }}
                            placeholder="e.g. Nalwoga Christine — LC1 Kyanja Zone A"
                            className="w-full bg-[#0d2e29] border border-teal-900/60 text-white placeholder-slate-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-teal-500 transition-colors" />
                        </div>
                        <div className="flex items-center gap-2 p-2 bg-teal-900/20 rounded-lg">
                          <FileText size={13} className="text-slate-500 flex-shrink-0" />
                          <p className="text-slate-500 text-xs">Document upload: Bring original to office or WhatsApp to +256 800 100 200</p>
                        </div>
                      </div>

                      {/* Referral Letter */}
                      <div className="bg-[#0a2420] border border-teal-900/40 rounded-xl p-4 space-y-3">
                        <div className="flex items-center gap-2 mb-1">
                          <FileText size={15} className="text-slate-400" />
                          <p className="text-slate-200 text-sm font-medium">Referral Letter (optional but recommended)</p>
                        </div>
                        <p className="text-slate-500 text-xs leading-relaxed">
                          A letter from a known person or organisation vouching for your character and work ethic.
                          Accepted from: employers, church leaders, community organisations, or existing ZITRUCKGO drivers.
                        </p>
                        <div>
                          <label className="block text-slate-400 text-xs font-medium mb-1.5">Referee Name / Organisation</label>
                          <input type="text" value={referralRef} onChange={e => setReferralRef(e.target.value)}
                            placeholder="e.g. Pastor Robert Ssekandi — Watoto Church Ntinda"
                            className="w-full bg-[#0d2e29] border border-teal-900/60 text-white placeholder-slate-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-teal-500 transition-colors" />
                        </div>
                        <div className="flex items-center gap-2 p-2 bg-teal-900/20 rounded-lg">
                          <FileText size={13} className="text-slate-500 flex-shrink-0" />
                          <p className="text-slate-500 text-xs">Document upload: Bring original to office or WhatsApp to +256 800 100 200</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {error && <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>}

                  {/* Navigation buttons */}
                  <div className="flex gap-3 mt-6">
                    {driverStepIndex > 0 && (
                      <button onClick={prevDriverStep} className="px-5 py-3 bg-[#0a2420] border border-teal-900/40 text-white font-medium rounded-xl hover:border-teal-700/60 transition-colors text-sm">
                        Back
                      </button>
                    )}
                    {!isLastDriverStep ? (
                      <button onClick={nextDriverStep} className="flex-1 py-3 bg-teal-500 hover:bg-teal-400 text-white font-semibold rounded-xl transition-all text-sm">
                        Continue →
                      </button>
                    ) : (
                      <button onClick={handleDriverRegister} disabled={loading} className="flex-1 py-3 bg-teal-500 hover:bg-teal-400 disabled:bg-teal-500/50 text-white font-semibold rounded-xl transition-all text-sm">
                        {loading ? 'Creating account...' : 'Register as Driver'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
            )}
          </>
          )}

          {!adminMode && !dispatchMode && (
          <p className="text-center text-slate-500 text-sm mt-6">
            {mode === 'login' ? "Don't have an account?" : 'Already registered?'}{' '}
            <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setDriverStep('account'); }}
              className="text-teal-400 hover:text-teal-300 font-medium">
              {mode === 'login' ? 'Register free' : 'Sign in'}
            </button>
          </p>
          )}
          {(adminMode || dispatchMode) && (
          <p className="text-center text-slate-500 text-sm mt-6">
            <button onClick={() => navigate('/')}
              className="text-teal-400 hover:text-teal-300 font-medium flex items-center justify-center gap-1.5">
              <ArrowLeft size={14} /> Back to home
            </button>
          </p>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-1">
      <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
        <Icon size={16} className="text-teal-400" />
      </div>
      <div>
        <p className="text-white font-semibold text-sm">{title}</p>
        {subtitle && <p className="text-slate-500 text-xs mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}
