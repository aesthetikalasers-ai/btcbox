export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { status, needsCredentials, busy, error, notice, googleEnabled, ethereumWallets, signInWithGoogle, signInWithWeb3, signInWithUsername, verifyTwoFactor, clearError } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [showEthereumWallets, setShowEthereumWallets] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (status === "authenticated") navigate(needsCredentials ? "/account-setup" : "/home", { replace: true });
    else if (status === "two-factor") navigate("/login", { replace: true });
  }, [status, needsCredentials, navigate]);

  if (status === "loading") return <div className="mx-auto flex min-h-[60vh] items-center justify-center text-sm text-brand-text-muted">Loading authentication…</div>;

  const submitUsername = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try { await signInWithUsername(username, password); }
    catch { /* AuthProvider displays the safe error. */ }
  };

  const dappUrl = window.location.origin + window.location.pathname;
  const phantomBrowseUrl = "https://phantom.app/ul/browse/" + encodeURIComponent(dappUrl) + "?ref=" + encodeURIComponent(window.location.origin);
  const coinbaseDappUrl = "https://go.cb-w.com/dapp?cb_url=" + encodeURIComponent(dappUrl);

  return <div className="mx-auto flex min-h-[calc(100dvh-150px)] w-full max-w-[480px] items-center justify-center p-4 sm:p-6">
    <Card className="w-full border-brand-border bg-brand-surface shadow-xl">
      <CardHeader className="gap-3 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-border bg-brand-surface-2"><ShieldCheck className="h-6 w-6 text-brand-text-secondary"/></div>
        <CardTitle className="text-xl">{status === "two-factor" ? "Two-step verification" : mode === "login" ? "Welcome back" : "Create your BTCBOX account"}</CardTitle>
        <CardDescription>{status === "two-factor" ? "Enter the verification code from your authenticator app." : mode === "login" ? "Sign in with your BTCBOX username and password, Google, or a wallet." : "Choose Google or a supported wallet. You’ll set your BTCBOX username and password after your first sign-in."}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <div role="alert" className="rounded-lg border border-loss/30 bg-loss/10 p-3 text-sm text-loss">{error}<button className="ml-2 inline-flex min-h-11 items-center px-2 underline" onClick={clearError}>Dismiss</button></div>}
        {notice && <div role="status" className="rounded-lg border border-brand-border bg-brand-surface-2 p-3 text-sm text-brand-text-secondary">{notice}</div>}
        {status === "two-factor" ? <form className="space-y-3" onSubmit={async e=>{e.preventDefault();setVerifyBusy(true);try{await verifyTwoFactor(code);}catch{/* AuthProvider displays the error. */}finally{setVerifyBusy(false);}}}>
          <Input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,8))} inputMode="numeric" autoComplete="one-time-code" placeholder="Authentication code" aria-label="Authentication code" required/>
          <Button type="submit" className="w-full" disabled={verifyBusy || code.length < 6}>{verifyBusy ? "Verifying…" : "Verify and continue"}</Button>
        </form> : <>
          {mode === "login" && <form className="space-y-3" onSubmit={submitUsername}>
            <label className="block space-y-1.5 text-sm"><span className="text-brand-text-secondary">BTCBOX username</span><Input value={username} onChange={e=>setUsername(e.target.value.toLowerCase())} autoComplete="username" placeholder="Your username" minLength={3} maxLength={24} required/></label>
            <label className="block space-y-1.5 text-sm"><span className="text-brand-text-secondary">Password</span><span className="relative block"><Input type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Your BTCBOX password" required className="pr-12"/><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={()=>setShowPassword(v=>!v)} className="absolute inset-y-0 right-1 inline-flex min-h-11 min-w-11 items-center justify-center text-brand-text-muted">{showPassword ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}</button></span></label>
            <Button type="submit" className="w-full" disabled={busy || status !== "anonymous" || !username.trim() || !password}>{busy ? "Please wait…" : "Sign in with username"}</Button>
          </form>}
          {mode === "register" && <div className="rounded-lg border border-brand-border bg-brand-surface-2 p-3 text-sm text-brand-text-secondary">No email address is required. After verification, BTCBOX will guide you to create a unique username and password for this same account.</div>}
          {googleEnabled && <><div className="flex items-center gap-3 py-1"><div className="h-px flex-1 bg-brand-border"/><span className="text-xs text-brand-text-muted">{mode === "login" ? "OR CONTINUE WITH" : "SIGN UP WITH"}</span><div className="h-px flex-1 bg-brand-border"/></div><Button className="w-full" size="lg" variant="outline" disabled={busy || status !== "anonymous"} onClick={signInWithGoogle}><Chrome className="h-5 w-5"/> Continue with Google</Button></>}
          <div className="flex items-center gap-3 py-1"><div className="h-px flex-1 bg-brand-border"/><span className="text-xs text-brand-text-muted">WEB3 WALLET</span><div className="h-px flex-1 bg-brand-border"/></div>
          <Button className="w-full" size="lg" variant="outline" disabled={busy || status !== "anonymous"} onClick={() => ethereumWallets.length > 1 ? setShowEthereumWallets(true) : void signInWithWeb3("ethereum", ethereumWallets[0]?.provider)}><Wallet className="h-5 w-5"/> Continue with Ethereum wallet</Button>
          {showEthereumWallets && <div className="space-y-2 rounded-lg border border-brand-border bg-brand-surface-2 p-3" aria-label="Choose Ethereum wallet">
            <p className="text-sm font-medium text-brand-text">Choose your Ethereum wallet</p>
            {ethereumWallets.map(wallet => <Button key={wallet.info.uuid} className="w-full justify-start" size="lg" variant="outline" disabled={busy} onClick={() => { setShowEthereumWallets(false); void signInWithWeb3("ethereum", wallet.provider); }}><Wallet className="h-4 w-4"/> {wallet.info.name}</Button>)}
            <Button className="w-full" variant="ghost" disabled={busy} onClick={() => setShowEthereumWallets(false)}>Cancel</Button>
          </div>}
          <Button className="w-full" size="lg" variant="outline" disabled={busy || status !== "anonymous"} onClick={() => void signInWithWeb3("solana")}><Wallet className="h-5 w-5"/> Continue with Solana wallet</Button>
          <div className="rounded-lg border border-brand-border bg-brand-surface-2 p-3 text-left">
            <p className="text-sm font-medium text-brand-text">Using a wallet on your phone?</p>
            <p className="mt-1 text-xs leading-5 text-brand-text-muted">Open BTCBOX inside your wallet’s built-in browser. MetaMask users can open the Explore tab and visit this site.</p>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <a className="inline-flex min-h-11 items-center rounded-lg px-3 py-2 font-medium text-brand-text underline underline-offset-4" href={phantomBrowseUrl} target="_blank" rel="noreferrer">Open in Phantom</a>
              <a className="inline-flex min-h-11 items-center rounded-lg px-3 py-2 font-medium text-brand-text underline underline-offset-4" href={coinbaseDappUrl} target="_blank" rel="noreferrer">Open in Coinbase Wallet</a>
            </div>
          </div>
        </>}
        <div className="text-center text-xs text-brand-text-muted">{mode === "login" ? <>New to BTCBOX? <Link className="text-brand-text underline underline-offset-4" to="/register">Create account</Link></> : <>Already have an account? <Link className="text-brand-text underline underline-offset-4" to="/login">Sign in</Link></>}</div>
        <Link to="/home" className="flex min-h-11 items-center justify-center gap-2 px-3 text-xs text-brand-text-muted hover:text-brand-text"><ArrowLeft className="h-3.5 w-3.5"/> Back to BTCBOX</Link>
      </CardContent>
    </Card>
  </div>;
}

export function AuthCallbackPage() {
  const { finishOAuth, completePasswordRecovery, status, needsCredentials, error, busy } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  useEffect(() => { if (status !== "loading" && status !== "authenticated" && status !== "two-factor" && status !== "password-recovery") void finishOAuth(); }, [finishOAuth, status]);
  useEffect(() => { if (status === "authenticated") navigate(needsCredentials ? "/account-setup" : "/home", { replace: true }); else if (status === "two-factor") navigate("/login", { replace: true }); }, [status, needsCredentials, navigate]);
  if (status === "password-recovery") return <div className="mx-auto flex min-h-[60vh] max-w-lg items-center justify-center p-6"><Card className="w-full border-brand-border bg-brand-surface"><CardHeader><CardTitle>Choose a new password</CardTitle><CardDescription>Enter and confirm your new BTCBOX password.</CardDescription></CardHeader><CardContent><form className="space-y-3" onSubmit={async e=>{e.preventDefault();if(password!==confirmPassword)return;setSaving(true);try{await completePasswordRecovery(password);}catch{/* Error is shown below. */}finally{setSaving(false);}}}><Input type="password" autoComplete="new-password" minLength={8} value={password} onChange={e=>setPassword(e.target.value)} placeholder="New password" required/><Input type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Confirm new password" required/>{password && confirmPassword && password!==confirmPassword && <p className="text-sm text-loss">Passwords do not match.</p>}<Button type="submit" className="w-full" disabled={saving || busy || password.length<8 || password!==confirmPassword}>{saving?"Updating…":"Update password"}</Button></form>{error && <p role="alert" className="mt-3 text-sm text-loss">{error}</p>}</CardContent></Card></div>;
  return <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-3 p-6 text-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-brand-accent"/><p className="text-sm text-brand-text-secondary">{error || (busy ? "Completing secure sign-in…" : "Finishing sign-in…")}</p>{error && <Link to="/login" className="text-sm underline">Return to sign in</Link>}</div>;
}
