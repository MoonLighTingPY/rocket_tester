export const applyKalmanFilter = (data) => {
    // Implement Kalman filter logic here
    // For simplicity, this is a placeholder implementation
    return data.map((point) => ({
      ...point,
      'Pressure1 (bar)': point['Pressure1 (bar)'] * 0.9,
      'Pressure2 (bar)': point['Pressure2 (bar)'] * 0.9,
    }));
  };
  
  export const applyGaussianFilter = (data) => {
    // Implement Gaussian filter logic here
    // For simplicity, this is a placeholder implementation
    return data.map((point) => ({
      ...point,
      'Pressure1 (bar)': point['Pressure1 (bar)'] * 0.95,
      'Pressure2 (bar)': point['Pressure2 (bar)'] * 0.95,
    }));
  };