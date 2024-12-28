// src/components/ChartControls.jsx

/* eslint-disable react/prop-types */
import { HStack, IconButton } from '@chakra-ui/react';
import { DownloadIcon, RepeatIcon, ViewIcon } from '@chakra-ui/icons';

const ChartControls = ({ chartRef, title, onDownload, onResetZoom, onOpen, setActiveChart }) => {
  const handleDownloadChart = () => {
    if (chartRef && chartRef.toBase64Image) {
      const link = document.createElement('a');
      const now = new Date();
      const localDateTime = now.toLocaleString('sv-SE', { timeZoneName: 'short' })
        .replace(' ', '_')
        .replace(':', '-');
      link.download = `${title}-${localDateTime}.png`;
      link.href = chartRef.toBase64Image();
      link.click();
    }
  };

  const handleResetZoom = () => {
    if (typeof chartRef?.resetZoom === 'function') {
      chartRef.resetZoom();
    }
  };

  return (
    <HStack 
      spacing={2} 
      position="absolute" 
      top={2} 
      right={2} 
      zIndex={10} // Increase z-index
      pointerEvents="auto" // Ensure clicks are captured
    >
      <IconButton
        size="sm"
        icon={<RepeatIcon />}
        onClick={() => handleResetZoom() || onResetZoom()}
        aria-label="Reset zoom"
      />
      <IconButton
        size="sm"
        icon={<DownloadIcon />}
        onClick={() => handleDownloadChart() || onDownload()}
        aria-label="Download chart"
      />
      <IconButton
        size="sm"
        icon={<ViewIcon />}
        onClick={() => {
          if (setActiveChart) {
            setActiveChart(title);
          }
          onOpen();
        }}
        aria-label="Fullscreen"
      />
    </HStack>
  );
};

export default ChartControls;