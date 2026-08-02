import React from 'react';
import { useNavigate } from 'react-router-dom';
import SettingsPage from '@/components/SettingsPage';

export default function BillingPage() {
  const navigate = useNavigate();
  return (
    <SettingsPage
      initialTab="invoicing"
      standalone
      onSelectJob={(job) => navigate('/admin', { state: { section: 'job-detail', job } })}
    />
  );
}