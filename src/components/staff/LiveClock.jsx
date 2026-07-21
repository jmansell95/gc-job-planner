import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';

export default function LiveClock({ className = '', dateClassName = '', timeClassName = '' }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={className}>
      <p className={dateClassName}>{format(now, 'EEEE, do MMMM yyyy')}</p>
      <p className={timeClassName}>{format(now, 'HH:mm:ss')}</p>
    </div>
  );
}