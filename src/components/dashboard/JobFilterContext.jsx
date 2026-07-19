import React, { createContext, useContext, useState } from 'react';

const JobFilterContext = createContext({ selectedJobId: 'all', setSelectedJobId: () => {} });

export const useJobFilter = () => useContext(JobFilterContext);

export function JobFilterProvider({ children }) {
  const [selectedJobId, setSelectedJobId] = useState('all');
  return (
    <JobFilterContext.Provider value={{ selectedJobId, setSelectedJobId }}>
      {children}
    </JobFilterContext.Provider>
  );
}