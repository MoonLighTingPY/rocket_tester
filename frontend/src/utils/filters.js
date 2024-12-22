// Kalman filter implementation
export const applyKalmanFilter = (data, settings) => {
    const { Q, R } = settings;
    let P = 1;        // Estimation error covariance
    let K = 0;        // Kalman gain
    let X = data[0]['Pressure1 (bar)']; // Initial estimate
  
    const filteredData = data.map((point) => {
      // Prediction update
      P = P + Q;
  
      // Measurement update
      K = P / (P + R);
      X = X + K * (point['Pressure1 (bar)'] - X);
      P = (1 - K) * P;
  
      return {
        ...point,
        'Pressure1 (bar)': X,
      };
    });
  
    P = 1;
    K = 0;
    X = data[0]['Pressure2 (bar)'];
  
    return filteredData.map((point, index) => {
      // Prediction update
      P = P + Q;
  
      // Measurement update
      K = P / (P + R);
      X = X + K * (data[index]['Pressure2 (bar)'] - X);
      P = (1 - K) * P;
  
      return {
        ...point,
        'Pressure2 (bar)': X,
      };
    });
  };
  
  // Gaussian filter implementation
  export const applyGaussianFilter = (data, settings) => {
    const { kernelSize } = settings;
    const gaussianKernel = Array(kernelSize).fill(1 / kernelSize); // Simple moving average kernel
    const halfKernelSize = Math.floor(kernelSize / 2);
  
    const applyKernel = (arr, index) => {
      let result = 0;
      for (let i = 0; i < kernelSize; i++) {
        const dataIndex = index + i - halfKernelSize;
        if (dataIndex >= 0 && dataIndex < arr.length) {
          result += arr[dataIndex] * gaussianKernel[i];
        }
      }
      return result;
    };
  
    const pressure1Data = data.map(point => point['Pressure1 (bar)']);
    const pressure2Data = data.map(point => point['Pressure2 (bar)']);
  
    const filteredPressure1 = pressure1Data.map((_, index) => applyKernel(pressure1Data, index));
    const filteredPressure2 = pressure2Data.map((_, index) => applyKernel(pressure2Data, index));
  
    return data.map((point, index) => ({
      ...point,
      'Pressure1 (bar)': filteredPressure1[index],
      'Pressure2 (bar)': filteredPressure2[index],
    }));
  };