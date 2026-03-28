import { useState, FormEvent } from "react";
import { getTranslations } from "../../shared/i18n";

interface Props {
  failed: boolean;
  onConnect: (key: string) => void;
}

export default function AccessDeniedPage({ failed, onConnect }: Props) {
  const [key, setKey] = useState("");

  const t = getTranslations("ro");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = key.trim();
    if (trimmed) onConnect(trimmed);
  };

  return (
    <div className="h-screen-safe bg-gray-900 flex items-start justify-center px-4 pt-[25vh]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-600/20 border border-red-600/40 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">{t.auth.accessDenied}</h1>
          <p className="text-sm text-gray-400">{t.auth.invalidKeyMessage}</p>
        </div>

        <form onSubmit={handleSubmit}>
          <label htmlFor="security-key" className="block text-sm font-medium text-gray-300 mb-2">
            {t.auth.securityKeyLabel}
          </label>
          <input
            id="security-key"
            type="text"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={t.auth.securityKeyPlaceholder}
            autoFocus
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono tracking-wider"
          />
          {failed && (
            <p className="mt-2 text-sm text-red-400">{t.auth.connectionFailed}</p>
          )}
          <button
            type="submit"
            className="w-full mt-4 px-4 py-3 rounded-lg text-sm font-medium bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/40 transition-colors"
          >
            {t.auth.connect}
          </button>
        </form>
      </div>
    </div>
  );
}
