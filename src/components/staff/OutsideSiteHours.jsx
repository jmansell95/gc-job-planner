import React from 'react';
import { motion } from 'framer-motion';
import { Moon, Clock, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function OutsideSiteHours({ openTime, closeTime }) {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const isAdmin = urlParams.get('admin') === 'true';

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="max-w-sm text-center">
        <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center mx-auto mb-5">
          <Moon className="w-10 h-10 text-slate-400" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Outside of site hours</h1>
        <p className="text-slate-500 text-sm leading-relaxed">
          The site is closed. Please come back tomorrow during site hours to check in and start your shift.
        </p>
        <div className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 rounded-xl text-sm font-semibold text-slate-600">
          <Clock className="w-4 h-4" /> Site hours: {openTime} – {closeTime}
        </div>
        {isAdmin && (
          <button onClick={() => navigate('/admin')}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 active:scale-95 transition touch-manipulation">
            <ShieldCheck className="w-4 h-4" /> Go to Admin Dashboard
          </button>
        )}
      </motion.div>
    </div>
  );
}