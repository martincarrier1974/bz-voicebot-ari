import { loginAction } from "@/app/actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-600">BZ Telecom</p>
          <h1 className="mt-2 text-3xl font-semibold">Connexion admin</h1>
          <p className="mt-2 text-sm text-slate-500">
            Connectez-vous pour gérer les prompts, flows, routes et la simulation du système vocal.
          </p>
        </div>

        {params.error ? (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            Identifiants invalides.
          </div>
        ) : null}

        <form action={loginAction} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Nom d’utilisateur</label>
            <input
              name="username"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none transition focus:border-sky-500"
              defaultValue="admin"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Mot de passe</label>
            <input
              name="password"
              type="password"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none transition focus:border-sky-500"
              defaultValue="admin123"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-sky-700"
          >
            Se connecter
          </button>
        </form>
      </div>
    </div>
  );
}
