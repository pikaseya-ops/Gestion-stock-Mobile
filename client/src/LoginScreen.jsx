import React, { useState } from 'react';
import { Cross, LogIn, Sparkles, Eye, EyeOff } from 'lucide-react';
import { useAuth } from './auth.jsx';
import { Btn, Input } from './ui.jsx';

export default function LoginScreen() {
  const { setupRequired } = useAuth();
  return setupRequired ? <SetupForm /> : <LoginForm />;
}

function CardShell({ icon: Icon, title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/40 to-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-md">
            <Icon className="w-7 h-7"/>
          </div>
          <h1 className="text-xl font-semibold text-slate-900 mt-4">{title}</h1>
          {subtitle && <p className="text-sm text-slate-600 mt-1">{subtitle}</p>}
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

function LoginForm() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err.message || 'Identifiant ou mot de passe incorrect');
    } finally {
      setLoading(false);
    }
  };

  return (
    <CardShell icon={Cross} title="Planning Pharmacie" subtitle="Connectez-vous pour accéder à l'application">
      <form onSubmit={submit} className="space-y-4">
        <Input
          label="Identifiant"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
          autoComplete="username"
          required
        />
        <div className="relative">
          <Input
            label="Mot de passe"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(s => !s)}
            className="absolute right-2 top-7 p-1.5 text-slate-400 hover:text-slate-600 rounded"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
          </button>
        </div>
        {error && (
          <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">
            {error}
          </div>
        )}
        <Btn type="submit" icon={LogIn} className="w-full" disabled={loading}>
          {loading ? 'Connexion...' : 'Se connecter'}
        </Btn>
      </form>
    </CardShell>
  );
}

function SetupForm() {
  const { setup } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('Mot de passe trop court (6 caractères minimum)'); return; }
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas'); return; }
    setLoading(true);
    try {
      await setup(username, password, displayName);
    } catch (err) {
      setError(err.message || 'Erreur lors de la création du compte');
    } finally {
      setLoading(false);
    }
  };

  return (
    <CardShell icon={Sparkles} title="Bienvenue !" subtitle="Première connexion : créez le compte titulaire">
      <form onSubmit={submit} className="space-y-4">
        <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg leading-relaxed">
          Ce premier compte sera l'<b>administrateur</b> (titulaire) de la pharmacie.
          Vous pourrez ensuite créer des comptes pour chaque membre de votre équipe.
        </div>
        <Input
          label="Votre nom (affiché dans l'équipe)"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="ex. Marie Dupont"
          autoFocus
          required
        />
        <Input
          label="Identifiant de connexion"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="ex. marie ou marie.dupont"
          autoComplete="username"
          required
        />
        <Input
          label="Mot de passe (6 caractères min.)"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
        <Input
          label="Confirmer le mot de passe"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
        />
        {error && (
          <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">
            {error}
          </div>
        )}
        <Btn type="submit" icon={Sparkles} className="w-full" disabled={loading}>
          {loading ? 'Création...' : 'Créer le compte et démarrer'}
        </Btn>
      </form>
    </CardShell>
  );
}
