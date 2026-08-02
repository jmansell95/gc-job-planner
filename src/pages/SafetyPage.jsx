import React from 'react';
import { useNavigate } from 'react-router-dom';
import SafetyCultureCheckHub from '@/components/safety/SafetyCultureCheckHub';

export default function SafetyPage() {
  const navigate = useNavigate();
  return (
    <SafetyCultureCheckHub onNavigate={(section) => navigate('/admin', { state: { section } })} />
  );
}