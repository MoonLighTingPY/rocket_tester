import { saveAs } from 'file-saver';
import Papa from 'papaparse';

export const generateCSV = (data, filename) => {
  const csvData = [];

  // Combine all data into a single array
  data.pressure.forEach((entry, index) => {
    csvData.push({
      timestamp: entry.timestamp,
      pressure1: entry.pressure1,
      pressure2: entry.pressure2,
      load: data.loadCell[index]?.load || '',
      temp: data.temperature[index]?.temp || ''
    });
  });

  const csv = Papa.unparse(csvData);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, filename);
};