'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  Chrome,
  Cloud,
  Github,
  Loader2,
  Mail,
  Send,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';
import {
  sendPasswordlessEmailLink,
  signInWithApple,
  signInWithGitHub,
  signInWithGoogle,
  translateFirebaseAuthError,
} from '@/lib/firebase/client';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [email, setEmail] = useState('');
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [emailSentTo, setEmailSentTo] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleProvider = async (
    providerKey: 'google' | 'apple' | 'github',
    action: () => Promise<unknown>
  ) => {
    setErrorMsg('');
    setLoadingProvider(providerKey);
    try {
      await action();
      onSuccess?.();
      onClose();
    } catch (err) {
      setErrorMsg(translateFirebaseAuthError(err));
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleSendEmailLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoadingProvider('email');
    try {
      await sendPasswordlessEmailLink(email);
      setEmailSentTo(email.trim());
    } catch (err) {
      setErrorMsg(translateFirebaseAuthError(err));
    } finally {
      setLoadingProvider(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="w-full max-w-md bg-[#10141D] border border-white/15 rounded-xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 bg-[#0D1017] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Cloud className="w-5 h-5 text-amber-400" aria-hidden="true" />
            <div>
              <h2 id="auth-modal-title" className="text-base font-bold text-white">
                تسجيل الدخول وحفظ المشاريع سحابياً
              </h2>
              <p className="text-xs text-slate-400">
                احفظ مشاريعك، وسائطك، الطبقات، والتنقية للوصول إليها في أي وقت
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق نافذة تسجيل الدخول"
            className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-white/5"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* OAuth Providers */}
          <div className="space-y-2.5">
            <button
              type="button"
              disabled={loadingProvider !== null}
              onClick={() => handleProvider('google', signInWithGoogle)}
              className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-lg bg-white text-slate-950 hover:bg-slate-100 font-semibold text-xs transition-colors disabled:opacity-50"
            >
              {loadingProvider === 'google' ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <Chrome className="w-4 h-4 text-sky-600" aria-hidden="true" />
              )}
              <span>المتابعة باستخدام حساب جوجل (Google)</span>
            </button>

            <button
              type="button"
              disabled={loadingProvider !== null}
              onClick={() => handleProvider('apple', signInWithApple)}
              className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-lg bg-[#1B2230] hover:bg-[#232C3E] text-white border border-white/15 font-semibold text-xs transition-colors disabled:opacity-50"
            >
              {loadingProvider === 'apple' ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <Smartphone className="w-4 h-4 text-slate-200" aria-hidden="true" />
              )}
              <span>المتابعة باستخدام حساب أبل (Apple)</span>
            </button>

            <button
              type="button"
              disabled={loadingProvider !== null}
              onClick={() => handleProvider('github', signInWithGitHub)}
              className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-lg bg-[#161B22] hover:bg-[#1F2733] text-white border border-white/15 font-semibold text-xs transition-colors disabled:opacity-50"
            >
              {loadingProvider === 'github' ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <Github className="w-4 h-4 text-slate-200" aria-hidden="true" />
              )}
              <span>المتابعة باستخدام حساب جيت هاب (GitHub)</span>
            </button>
          </div>

          <div className="relative flex items-center py-1">
            <div className="flex-grow border-t border-white/10" />
            <span className="shrink mx-3 text-[11px] text-slate-400">
              أو الدخول عبر رسالة تحقق بالبريد الإلكتروني
            </span>
            <div className="flex-grow border-t border-white/10" />
          </div>

          {/* Passwordless Email Verification Link ONLY */}
          {emailSentTo ? (
            <div className="p-4 rounded-lg bg-emerald-950/40 border border-emerald-500/40 space-y-2 text-center">
              <CheckCircle2 className="w-7 h-7 text-emerald-400 mx-auto" aria-hidden="true" />
              <div className="text-xs font-bold text-emerald-200">
                تم إرسال رابط التحقق السحري إلى بريدك!
              </div>
              <p className="text-[11px] text-emerald-200/80 leading-relaxed">
                افتح البريد المرسل إلى <span dir="ltr" className="font-mono font-bold">{emailSentTo}</span> واضغط على رابط الدخول لتسجيل دخولك فوراً بدون كلمة مرور.
              </p>
              <button
                type="button"
                onClick={() => setEmailSentTo(null)}
                className="text-[11px] text-amber-300 hover:underline pt-1"
              >
                إرسال إلى بريد آخر
              </button>
            </div>
          ) : (
            <form onSubmit={handleSendEmailLink} className="space-y-2.5">
              <label htmlFor="auth-email-input" className="text-xs text-slate-300 block">
                البريد الإلكتروني (دخول برابط تحقق فقط — بدون كلمة مرور)
              </label>
              <div className="relative">
                <Mail
                  className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="auth-email-input"
                  type="email"
                  dir="ltr"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-[#161C27] border border-white/15 focus:border-amber-400 rounded-lg pr-9 pl-3 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none text-left"
                />
              </div>
              <button
                type="submit"
                disabled={loadingProvider !== null}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs transition-colors disabled:opacity-50"
              >
                {loadingProvider === 'email' ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="w-4 h-4" aria-hidden="true" />
                )}
                <span>إرسال رسالة التحقق للبريد الإلكتروني</span>
              </button>
            </form>
          )}

          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-xs text-rose-200 leading-relaxed">
              {errorMsg}
            </div>
          )}

          <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
            <span>جميع مشاريعك ووسائطك محمية ومرتبطة بحسابك الشخصي فقط.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
