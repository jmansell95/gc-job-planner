import React, { createContext, useContext, useState } from 'react';

const JobFilterContext = createContext({
  selectedJobId: 'all',
  setSelectedJobId: () => {},
  disciplineFilter: 'all',
  setDisciplineFilter: () => {},
});

export const useJobFilter = () => useContext(JobFilterContext);

export function JobFilterProvider({ children }) {
  const [selectedJobId, setSelectedJobId] = useState('all');
  const [disciplineFilter, setDisciplineFilter] = useState('all');
  return (
    <JobFilterContext.Provider value={{ selectedJobId, setSelectedJobId, disciplineFilter, setDisciplineFilter }}>
      {children}
    </JobFilterContext.Provider>
  );
}