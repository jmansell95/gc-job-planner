import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import GeotechScene from './GeotechScene';
import LandWaterScene from './LandWaterScene';
import InfrastructureScene from './InfrastructureScene';
import LabScene from './LabScene';
import EnvironmentalScene from './EnvironmentalScene';
import SurveysScene from './SurveysScene';
import StructuralScene from './StructuralScene';
import RenewablesScene from './RenewablesScene';
import GeneralScene from './GeneralScene';
import RoadCareScene from './RoadCareScene';

/**
 * DivisionLoadingScreen — full-screen animated splash shown when entering ANY
 * division. The animated scene is selected automatically from the division's
 * type (geotechnical → drilling rig, land_water → boat, etc.), and the
 * division's tagline/description is shown as the subtitle. New divisions
 * created via the wizard inherit their type's scene automatically — no manual
 * configuration needed.
 */
const SCENES = {
  geotechnical: GeotechScene,
  land_water: LandWaterScene,
  infrastructure: InfrastructureScene,
  road_care: RoadCareScene,
  lde: LabScene,
  environmental: EnvironmentalScene,
  surveys: SurveysScene,
  structural: StructuralScene,
  renewables: RenewablesScene,
  general: GeneralScene,
};

export default function DivisionLoadingScreen({ division, onComplete, duration = 3600 }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, (elapsed / duration) * 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(interval);
        onComplete?.();
      }
    }, 30);
    return () => clearInterval(interval);
  }, [duration, onComplete]);

  const divColor = division?.color || '#2E5A1A';
  const divName = division?.name || 'Division';
  const subtitle = division?.tagline || division?.description || '';
  const Scene = SCENES[division?.division_type] || GeneralScene;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden"
      style={{ background: `linear-gradient(155deg, ${divColor} 0%, ${divColor}cc 40%, #0a120a 100%)` }}
    >
      {/* Ambient glow */}
      <motion.div
        className="absolute w-[28rem] h-[28rem] rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(141,198,63,0.22) 0%, transparent 70%)' }}
        animate={{ scale: [1, 1.18, 1], opacity: [0.4, 0.65, 0.4] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Animated scene */}
      <motion.div
        className="relative w-72 h-72 mb-6 z-10"
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <Scene color={divColor} />
      </motion.div>

      {/* Division name */}
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-xl font-extrabold text-white tracking-tight mb-1 z-10"
      >
        {divName} is loading
      </motion.h2>
      {subtitle && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-sm text-white/60 font-medium mb-6 z-10 text-center max-w-xs px-4"
        >
          {subtitle}
        </motion.p>
      )}

      {/* Progress bar */}
      <div className="w-56 h-1.5 bg-white/15 rounded-full overflow-hidden z-10">
        <div
          className="h-full rounded-full transition-all duration-75 ease-out"
          style={{ background: `linear-gradient(to right, ${divColor}, #ffffff)`, width: `${progress}%` }}
        />
      </div>
    </motion.div>
  );
}