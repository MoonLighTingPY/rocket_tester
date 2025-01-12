export const applyKalmanFilter = (data, settings, target) => {
  const { Q, R } = settings;
  let P = 1;        // Estimation error covariance
  let K = 0;        // Kalman gain
  let X = data[0][target]; // Initial estimate

  const filteredData = data.map((point) => {
    // Prediction update
    P = P + Q;

    // Measurement update
    K = P / (P + R);
    X = X + K * (point[target] - X);
    P = (1 - K) * P;

    return {
      ...point,
      [target]: X,
    };
  });

  return filteredData;
};
  
export const applyGaussianFilter = (data, settings, target) => {
  const { kernelSize } = settings;
  const gaussianKernel = Array(kernelSize).fill(1 / kernelSize);
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
  
  const targetData = data.map(point => point[target]);
  const filteredTarget = targetData.map((_, index) => applyKernel(targetData, index));
  
  return data.map((point, index) => ({
    ...point,
    [target]: filteredTarget[index],
  }));
};