/* eslint-disable react/prop-types */
import { createContext, useState } from 'react';

const ReadingContext = createContext();

export const ReadingProvider = ({ children }) => {
  const [isReading, setIsReading] = useState(false);

  return (
    <ReadingContext.Provider value={{ isReading, setIsReading }}>
      {children}
    </ReadingContext.Provider>
  );
};

export default ReadingContext;